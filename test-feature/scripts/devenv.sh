#!/usr/bin/env bash
# devenv.sh — start, inspect and stop the dev environment of a test run.
#
#   devenv.sh up     --name NAME --cwd DIR --cmd "pnpm dev" --ready PROBE [--ready PROBE]... [--timeout 180]
#   devenv.sh status [--name NAME]
#   devenv.sh down   --name NAME [--restore]
#
# PROBE is one of:
#   http://host:port/path   any HTTP answer below 500 (a 303 to a login page is ready)
#   tcp:port | tcp:host:port a listener on the port
#   log:REGEX               a line of the process log matches REGEX (grep -E)
#   file:PATH               the file exists
#
# Rules:
#   - If every probe already passes, `up` reuses the environment and `down` does not stop it.
#     A listener that runs from another directory is refused: it can be another checkout.
#   - `down` stops the processes that `up` started, and only them: children in other process
#     groups and daemons included (see env_pids).
#   - `up` records `git status --porcelain`. `down` reports the files that changed after it.
#     `--restore` puts back the tracked files that changed. It never deletes a file.
#
# Written for the bash 3.2 of macOS: no associative arrays, no setsid.

set -u

STATE_ROOT="${DEVENV_STATE:-${TMPDIR:-/tmp}/claude-devenv}"

die() { echo "devenv: $*" >&2; exit 1; }
say() { echo "devenv: $*"; }

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

# The port of a probe, or nothing for log: and file: probes.
probe_port() {
  case "$1" in
    tcp:*:*) echo "${1##*:}" ;;
    tcp:*) echo "${1#tcp:}" ;;
    http://* | https://*)
      local rest="${1#*://}"; rest="${rest%%/*}"
      case "$rest" in
        *:*) echo "${rest##*:}" ;;
        *) case "$1" in https://*) echo 443 ;; *) echo 80 ;; esac ;;
      esac ;;
  esac
}

probe_ok() { # $1 probe, $2 log file
  case "$1" in
    http://* | https://*)
      local code
      code=$(curl -s -o /dev/null -m 3 -w '%{http_code}' "$1" 2>/dev/null)
      [ -n "$code" ] && [ "$code" != "000" ] && [ "$code" -lt 500 ] ;;
    tcp:*)
      lsof -nP -iTCP:"$(probe_port "$1")" -sTCP:LISTEN >/dev/null 2>&1 ;;
    log:*)
      [ -f "$2" ] && grep -Eq -- "${1#log:}" "$2" ;;
    file:*)
      [ -e "${1#file:}" ] ;;
    *) die "unknown probe: $1" ;;
  esac
}

# The working directory of the process that listens on a port.
listener_cwd() {
  local pid
  pid=$(lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1)
  [ -n "$pid" ] || return 1
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

# The top of the git checkout that holds a directory, or the directory itself.
tree_of() { (cd "$1" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null) || (cd "$1" && pwd -P); }

# The processes of an environment. Three sources, because each one misses some:
#   - DEVENV_TAG in the environment: it follows children that a launcher (pnpm, nx) moves to
#     another process group, and daemons that leave the tree. On macOS, ps cannot read it for
#     system binaries (/bin/sleep, /usr/bin/python3).
#   - the descendants, by parent pid, of the leader and of the tagged processes.
#   - the listeners of the probe ports at the time the environment was ready (file `listeners`).
tagged() { # $1 tag
  ps eww -A -o pid=,command= 2>/dev/null | grep -F "DEVENV_TAG=$1" | grep -v grep | awk '{print $1}' | grep -vx "$$"
}

env_pids() { # $1 state dir
  local roots table
  roots=$( { cat "$1/pgid" 2>/dev/null; tagged "$(cat "$1/tag" 2>/dev/null)"; } | tr '\n' ' ')
  table=$(ps -A -o pid=,ppid=)
  {
    echo "$table" | awk -v roots="$roots" '
      { parent[$1] = $2; pids[NR] = $1 }
      END {
        n = split(roots, r, " "); for (i = 1; i <= n; i++) keep[r[i]] = 1
        do { added = 0
          for (i in pids) { p = pids[i]; if (!(p in keep) && (parent[p] in keep)) { keep[p] = 1; added = 1 } }
        } while (added)
        for (p in keep) if (p in parent) print p
      }'
    [ -f "$1/listeners" ] && while read -r p; do kill -0 "$p" 2>/dev/null && echo "$p"; done <"$1/listeners"
  } | sort -u | grep -vx "$$"
}

stop_env() { # $1 state dir
  local pids i=0
  pids=$(env_pids "$1")
  [ -n "$pids" ] || return 0
  kill -TERM -- "-$(cat "$1/pgid" 2>/dev/null)" 2>/dev/null
  kill -TERM $pids 2>/dev/null
  while [ $i -lt 20 ]; do
    pids=$(echo "$pids" | while read -r p; do kill -0 "$p" 2>/dev/null && echo "$p"; done)
    [ -z "$pids" ] && return 0
    sleep 0.5; i=$((i + 1))
  done
  kill -KILL $pids 2>/dev/null
  return 0
}

# One line per changed or new file: its path and a hash of its content. A hash, because a file
# that was already modified before `up` can change again while the environment runs.
snapshot() { # $1 dir
  (cd "$1" && git status --porcelain --untracked-files=all 2>/dev/null | cut -c4- | while IFS= read -r f; do
    printf '%s\t%s\n' "$f" "$( [ -f "$f" ] && git hash-object -- "$f" 2>/dev/null || echo gone)"
  done | sort)
}

changed_files() { # $1 dir, $2 snapshot file
  [ -f "$2" ] || return 0
  snapshot "$1" | comm -13 "$2" - | cut -f1
}

# The pids that listen on the probe ports and run from the checkout.
record_listeners() { # $1 probes, $2 tree
  local probe port pid owner
  echo "$1" | while IFS= read -r probe; do
    port=$(probe_port "$probe")
    [ -n "$port" ] || continue
    for pid in $(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null); do
      owner=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
      case "$owner/" in "$2"/*) echo "$pid" ;; esac
    done
  done | sort -u
}

report_changes() { # $1 name, $2 dir, $3 snapshot file, $4 restore (0 or 1)
  local changed
  changed=$(changed_files "$2" "$3")
  [ -n "$changed" ] || return 0
  say "$1: these files changed in $2 while it ran:"
  echo "$changed" | sed 's/^/  /'
  if [ "$4" -eq 1 ]; then
    # Tracked files only: an untracked file can be the work of somebody else.
    echo "$changed" | while IFS= read -r f; do
      (cd "$2" && git ls-files --error-unmatch -- "$f" >/dev/null 2>&1 && git checkout -- "$f" && echo "  restored $f")
    done
  else
    say "check them. If the run made them, 'down --restore' puts back the tracked ones."
  fi
}

cmd_up() {
  local name="" cwd="$PWD" cmd="" timeout=180 probes=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --name) name="$2"; shift 2 ;;
      --cwd) cwd="$2"; shift 2 ;;
      --cmd) cmd="$2"; shift 2 ;;
      --ready) probes="$probes$2"$'\n'; shift 2 ;;
      --timeout) timeout="$2"; shift 2 ;;
      *) die "up: unknown argument $1" ;;
    esac
  done
  [ -n "$name" ] || die "up: --name is required"
  [ -n "$cmd" ] || die "up: --cmd is required"
  [ -n "$probes" ] || die "up: give at least one --ready probe"
  cwd=$(cd "$cwd" && pwd -P) || die "up: no directory $cwd"
  local dir="$STATE_ROOT/$name" tree
  tree=$(tree_of "$cwd")

  if [ -f "$dir/tag" ] && [ -n "$(env_pids "$dir")" ]; then
    say "$name already runs, log $dir/log"
    return 0
  fi

  # Check each port before the start: a listener of another checkout answers the probes too.
  local all_ok=1 probe port owner
  while IFS= read -r probe; do
    [ -n "$probe" ] || continue
    port=$(probe_port "$probe")
    if [ -n "$port" ] && owner=$(listener_cwd "$port"); then
      case "$owner/" in
        "$tree"/*) ;;
        *) die "port $port belongs to a process in $owner, not in $tree. Stop it, or use another port." ;;
      esac
    fi
    probe_ok "$probe" "$dir/log" || all_ok=0
  done <<EOF
$probes
EOF
  mkdir -p "$dir"
  printf '%s\n' "$cwd" >"$dir/cwd"
  printf '%s\n' "$cmd" >"$dir/cmd"
  if [ $all_ok -eq 1 ]; then
    echo reused >"$dir/mode"
    rm -f "$dir/pgid"
    say "$name: every probe already passes, from $tree. Reused: down will not stop it."
    return 0
  fi

  snapshot "$cwd" >"$dir/git-before"
  echo started >"$dir/mode"
  : >"$dir/log"
  local tag="$name-$$-$RANDOM"
  echo "$tag" >"$dir/tag"
  # perl gives the command a process group of its own. DEVENV_TAG marks every process it starts.
  # exec: no subshell stays alive with the output of this script, so the caller returns at once.
  (cd "$cwd" && DEVENV_TAG="$tag" exec nohup perl -e 'setpgrp(0, 0); exec @ARGV' sh -c "$cmd" >>"$dir/log" 2>&1 </dev/null) &
  local pgid=$!
  echo "$pgid" >"$dir/pgid"
  disown "$pgid" 2>/dev/null
  say "$name: started '$cmd' in $cwd (pgid $pgid), log $dir/log"

  local waited=0 pending
  while :; do
    pending=""
    while IFS= read -r probe; do
      [ -n "$probe" ] || continue
      probe_ok "$probe" "$dir/log" || pending="$pending $probe"
    done <<EOF
$probes
EOF
    if [ -z "$pending" ]; then
      record_listeners "$probes" "$tree" >"$dir/listeners"
      say "$name: ready after ${waited}s"
      return 0
    fi
    if [ -z "$(env_pids "$dir")" ]; then
      echo "--- last lines of $dir/log" >&2; tail -30 "$dir/log" >&2
      die "$name: the command stopped before it was ready."
    fi
    if [ $waited -ge "$timeout" ]; then
      echo "--- last lines of $dir/log" >&2; tail -30 "$dir/log" >&2
      stop_env "$dir"; rm -f "$dir/pgid" "$dir/tag"
      report_changes "$name" "$cwd" "$dir/git-before" 0
      die "$name: not ready after ${timeout}s, waiting for:$pending. Stopped."
    fi
    sleep 2; waited=$((waited + 2))
  done
}

cmd_down() {
  local name="" restore=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --name) name="$2"; shift 2 ;;
      --restore) restore=1; shift ;;
      *) die "down: unknown argument $1" ;;
    esac
  done
  [ -n "$name" ] || die "down: --name is required"
  local dir="$STATE_ROOT/$name"
  [ -d "$dir" ] || die "down: no environment named $name"
  if [ "$(cat "$dir/mode" 2>/dev/null)" = reused ]; then
    say "$name was reused, not started: left running."
    rm -rf "$dir"; return 0
  fi
  if [ -f "$dir/tag" ]; then
    local count left
    count=$(env_pids "$dir" | grep -c .)
    stop_env "$dir"
    say "$name: stopped $count processes"
    left=$(env_pids "$dir")
    [ -n "$left" ] && say "WARNING: still alive: $(echo $left)"
  fi
  report_changes "$name" "$(cat "$dir/cwd")" "$dir/git-before" "$restore"
  rm -rf "$dir"
}

cmd_status() {
  local only=""
  [ "${1:-}" = "--name" ] && only="$2"
  [ -d "$STATE_ROOT" ] || { say "no environment"; return 0; }
  local d n state found=0
  for d in "$STATE_ROOT"/*/; do
    [ -d "$d" ] || continue
    found=1
    n=$(basename "$d")
    [ -n "$only" ] && [ "$n" != "$only" ] && continue
    if [ "$(cat "$d/mode" 2>/dev/null)" = reused ]; then state="reused"
    elif [ -f "$d/tag" ] && [ -n "$(env_pids "${d%/}")" ]; then
      state="running ($(env_pids "${d%/}" | grep -c .) processes)"
    else state="stopped"
    fi
    echo "$n: $state · $(cat "$d/cmd" 2>/dev/null) · $(cat "$d/cwd" 2>/dev/null) · log ${d}log"
  done
  [ $found -eq 1 ] || say "no environment"
}

case "${1:-}" in
  up) shift; cmd_up "$@" ;;
  down) shift; cmd_down "$@" ;;
  status) shift; cmd_status "$@" ;;
  -h | --help | help) usage 0 ;;
  *) usage 1 ;;
esac

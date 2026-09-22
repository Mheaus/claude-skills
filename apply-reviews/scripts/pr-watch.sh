#!/usr/bin/env bash
# Watch a pull request and print each new signal of pr-signals.sh as it lands.
# Run it under the Monitor tool: each printed line is a notification.
#
# Configuration:
#   PR        pull request number (required)
#   REPO      owner/repo (default: the repository of the current directory)
#   QUIET     seconds without a new signal before the watch stops (default: 600)
#   INTERVAL  seconds between two snapshots (default: 30)
#   UNTIL     stop at the first new line that matches this extended regex (optional)
#   EXPECT    extended regex of check names that must exist on the head (optional)
#   MIN_CHECKS  number of checks that must exist on the head (default: 1)
#
# The quiet time counts only while the checks of the head commit are settled. CI can start
# many minutes after a push. A reviewer status can arrive in seconds and look settled alone,
# so give EXPECT or MIN_CHECKS, or the watch can stop before CI exists.
set -uo pipefail

: "${PR:?set PR to the pull request number}"
QUIET=${QUIET:-600}
INTERVAL=${INTERVAL:-30}
SIGNALS="$(dirname "$0")/pr-signals.sh"

snapshot() { PR=$PR REPO=${REPO:-} "$SIGNALS" 2>/dev/null | sort -u; }

ready() {
  echo "$1" | grep -qx 'checks settled' || return 1
  [ "$(echo "$1" | grep -c '^check ')" -ge "${MIN_CHECKS:-1}" ] || return 1
  [ -z "${EXPECT:-}" ] || echo "$1" | grep -E '^check ' | cut -d' ' -f2 | grep -qE "$EXPECT"
}

seen=$(snapshot)
echo "watch PR $PR: $(echo "$seen" | grep -c .) signals already in, $(echo "$seen" | grep '^checks ')"
quiet=0
while [ "$quiet" -lt "$QUIET" ]; do
  sleep "$INTERVAL"
  if ! now=$(snapshot) || [ -z "$now" ]; then
    echo "snapshot failed, retry"
    continue
  fi
  new=$(comm -13 <(echo "$seen") <(echo "$now"))
  seen=$now
  if [ -n "$new" ]; then
    echo "$new"
    quiet=0
    if [ -n "${UNTIL:-}" ] && echo "$new" | grep -qE "$UNTIL"; then
      echo "matched UNTIL, stop"
      exit 0
    fi
  elif ready "$now"; then
    quiet=$((quiet + INTERVAL))
  fi
done
echo "quiet for ${QUIET}s with settled checks, stop"

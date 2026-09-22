#!/usr/bin/env bash
# Print one line per signal on a pull request: reviews, line comments, conversation
# comments, quota notices and checks of the head commit. The output is stable between
# two calls when nothing changes, so a watch can diff two snapshots.
#
# Configuration:
#   PR    pull request number (required)
#   REPO  owner/repo (default: the repository of the current directory)
#
# Line formats:
#   head <sha8>
#   review <login> <state> <commit8> <submitted_at> <human|bot> [quota]
#   comment <id> <login> <updated_at> <human|bot> [reply]
#   conversation <id> <login> <updated_at> <human|bot> [quota] [until=<iso>]
#   check <name> <status> <conclusion> [quota]
#   checks none|pending=<n>|settled
#
# A reply in a thread makes GitHub add an empty COMMENTED review; the script skips it for people.
# A check run has no description. The script tags it `quota` only if its name is the login of a
# reviewer that refused for quota on the head commit.
#
# Bodies that contain the marker <!-- claude-reply --> are replies of the agent. The script
# skips them, because the agent and the user can post with the same login.
set -euo pipefail

: "${PR:?set PR to the pull request number}"
REPO=${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}

QUOTA='quota|rate.limit|limit reached|unable to review|usage limit'
MARKER='<!-- claude-reply -->'

all() { gh api --paginate --slurp "$1" | jq -c 'add // [] | .[]'; }
signals() { jq -r --arg q "$QUOTA" --arg m "$MARKER" "$1"; }

# `in_marker` and `kind` are shared by the three comment sources.
PRELUDE='
  def body: .body // "";
  def mine: body | contains($m);
  def quota: test($q; "i");
  def kind: if (.user.login | endswith("[bot]")) or .user.login == "Copilot" then "bot" else "human" end;
'

head=$(gh api "repos/$REPO/pulls/$PR" --jq .head.sha)
echo "head ${head:0:8}"

reviews=$(all "repos/$REPO/pulls/$PR/reviews")
echo "$reviews" | signals "$PRELUDE"'
  select(mine | not)
  | select(kind == "bot" or .state != "COMMENTED" or body != "")
  | "review \(.user.login) \(.state) \(.commit_id[0:8]) \(.submitted_at) \(kind)"
    + (if body | quota then " quota" else "" end)'
refused=$(echo "$reviews" | jq -r --arg h "$head" --arg q "$QUOTA" '
  select(.commit_id == $h and ((.body // "") | test($q; "i"))) | .user.login | sub("\\[bot\\]$"; "")' | sort -u)

all "repos/$REPO/pulls/$PR/comments" | signals "$PRELUDE"'
  select(mine | not)
  | "comment \(.id) \(.user.login) \(.updated_at) \(kind)"
    + (if .in_reply_to_id then " reply" else "" end)'

# A bot can edit one conversation comment in place, so updated_at is part of the key.
# A delay is announced as "available in N minutes" or "in N hours"; count it from the edit time.
all "repos/$REPO/issues/$PR/comments" | signals "$PRELUDE"'
  select(mine | not)
  | (body | capture("in (?<n>[0-9]+) (?<u>minute|hour)"; "i")? // null) as $d
  | "conversation \(.id) \(.user.login) \(.updated_at) \(kind)"
    + (if body | quota then " quota"
         + (if $d then " until=" + ((.updated_at | fromdateiso8601)
              + ($d.n | tonumber) * (if ($d.u | ascii_downcase) == "hour" then 3600 else 60 end)
              | todateiso8601) else "" end)
       else "" end)'

checks=$(
  gh api --paginate --slurp "repos/$REPO/commits/$head/check-runs?per_page=100" \
    | jq -r --arg r "$refused" '($r | split("\n")) as $refused | [.[].check_runs[]] | .[]
      | "check \(.name | gsub(" "; "_")) \(.status) \(.conclusion // "none")"
        + (if [.name] | inside($refused) then " quota" else "" end)'
  gh api "repos/$REPO/commits/$head/status" | signals '
    .statuses[]
    | "check \(.context | gsub(" "; "_")) \(if .state == "pending" then "in_progress" else "completed" end) \(.state)"
      + (if (.description // "") | test($q; "i") then " quota" else "" end)'
)
if [ -n "$checks" ]; then
  echo "$checks" | sort
  pending=$(echo "$checks" | grep -cv ' completed ' || true)
  if [ "$pending" -gt 0 ]; then echo "checks pending=$pending"; else echo "checks settled"; fi
else
  echo "checks none"
fi

#!/usr/bin/env bash
# publish.sh — post a piece of evidence on the PR, or put it on the MinIO bucket.
#
#   publish.sh FILE --title "Feature name" [--note "what it proves"] [--pr N] [--repo owner/repo]
#              [--github] [--no-comment] [--dry-run]
#
# FILE: a video (.webm .mp4 .mov), an image (.gif .png .jpg .webp), or text (.txt .log .cast .md).
#
# By default the file goes to MinIO, and the comment links to it. The comment keeps the author
# that gh uses: the App of the agent, for example.
#
# --github uploads an image or a video to GitHub with `gh pr comment --attach` (gh 2.99 or later).
# The upload endpoint refuses an App installation token (404, "requires write access"), whatever
# the permissions of the App. The script then tries again once with GH_TOKEN unset and
# SAKUGA_AGENT_OFF=1, so gh uses the user's own login: that comment has the user as its author.
# If GitHub refuses, for text, or for a file above 10 MB, it goes to MinIO.
#
# With no PR, or with --no-comment, it uploads to MinIO and prints the URL only: attach it to
# the Linear issue.
#
# Output lines: `HOST github|minio`, `URL <file url>`, and `COMMENT <comment url>` if it commented.
#
# On GitHub, the file is as visible as the repository. On MinIO, anyone who has the URL can read
# it. Do not publish a secret, a token or personal data: a screenshot or a log can show them.

set -euo pipefail

ENDPOINT="https://s3.deploy.sakuga.dev"
BUCKET="public"
ACCESS_KEY="test-feature-uploader"
KEYCHAIN_SERVICE="sakuga-minio-test-feature-uploader"
GITHUB_MAX_BYTES=$((10 * 1024 * 1024))

die() { echo "publish: $*" >&2; exit 1; }
note() { echo "publish: $*" >&2; }

file="" title="" text="" pr="" repo="" comment=1 dry=0 github=0
while [ $# -gt 0 ]; do
  case "$1" in
    --title) title="$2"; shift 2 ;;
    --note) text="$2"; shift 2 ;;
    --pr) pr="$2"; shift 2 ;;
    --repo) repo="$2"; shift 2 ;;
    --github) github=1; shift ;;
    --no-comment) comment=0; shift ;;
    --dry-run) dry=1; shift ;;
    -h | --help) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "unknown argument $1" ;;
    *) file="$1"; shift ;;
  esac
done
[ -f "$file" ] || die "no file: ${file:-<none>}"
[ -n "$title" ] || die "--title is required"
file=$(cd "$(dirname "$file")" && pwd -P)/$(basename "$file")

ext=$(echo "${file##*.}" | tr '[:upper:]' '[:lower:]')
case "$ext" in
  webm) type=video/webm kind=video ;;
  mp4) type=video/mp4 kind=video ;;
  mov) type=video/quicktime kind=video ;;
  gif) type=image/gif kind=image ;;
  png) type=image/png kind=image ;;
  jpg | jpeg) type=image/jpeg kind=image ;;
  webp) type=image/webp kind=image ;;
  txt | log | cast | md) type="text/plain; charset=utf-8" kind=text ;;
  *) die "unsupported type .$ext" ;;
esac
bytes=$(wc -c <"$file" | tr -d ' ')

repo_args=()
[ -n "$repo" ] && repo_args=(--repo "$repo")
if [ $comment -eq 1 ] && [ -z "$pr" ]; then
  pr=$(gh pr view ${repo_args[@]+"${repo_args[@]}"} --json number -q .number 2>/dev/null || true)
fi

# The comment body. `ref` is where the file goes: its local path for GitHub (gh rewrites it to
# the uploaded URL), its URL for MinIO. A video must be alone in its paragraph to show a player.
body_for() { # $1 ref, $2 host
  local embed
  case "$kind" in
    video) if [ "$2" = github ]; then embed="![]($1)"; else
      embed="<video src=\"$1\" controls muted></video>

([video]($1) if the player does not show)"; fi ;;
    image) embed="![$title]($1)" ;;
    text) embed="[$title — transcript]($1)" ;;
  esac
  # The marker tells the review watch that the agent wrote this comment, not the user.
  printf '### Test recording — %s\n%s\n%s\n\n<!-- claude-reply -->\n' "$title" "${text:+
$text
}" "$embed"
}

gh_version_ok() {
  local v major minor
  v=$(gh --version 2>/dev/null | head -1 | sed -n 's/^gh version \([0-9]*\)\.\([0-9]*\).*/\1 \2/p')
  read -r major minor <<<"${v:-0 0}"
  [ "$major" -gt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -ge 99 ]; }
}

# Try the GitHub upload. Prints the comment URL. Returns 1 if GitHub refused, and posted nothing.
post_on_github() { # $@ extra env for gh (empty, or the user's login)
  local bodyfile out
  bodyfile=$(mktemp)
  body_for "$file" github >"$bodyfile"
  if out=$(env "$@" gh pr comment "$pr" ${repo_args[@]+"${repo_args[@]}"} --body-file "$bodyfile" --attach "$file" 2>&1); then
    rm -f "$bodyfile"
    echo "$out" | grep -o 'https://github.com/[^ ]*#issuecomment-[0-9]*' | tail -1
    return 0
  fi
  rm -f "$bodyfile"
  note "GitHub refused the upload: $(echo "$out" | head -1)"
  return 1
}

if [ $comment -eq 1 ] && [ -n "$pr" ] && [ $github -eq 1 ] && [ "$kind" != text ] &&
  [ "$bytes" -le $GITHUB_MAX_BYTES ]; then
  if ! gh_version_ok; then
    note "gh $(gh --version | head -1 | awk '{print $3}') has no --attach (2.99 or later). MinIO instead."
  elif [ $dry -eq 1 ]; then
    echo "DRY gh pr comment $pr --attach $file, with this body:"
    body_for "$file" github
    exit 0
  else
    link=""
    link=$(post_on_github) || link=$(post_on_github -u GH_TOKEN SAKUGA_AGENT_OFF=1) || link=""
    if [ -n "$link" ]; then
      id=${link##*-}
      slug_repo=$(echo "$link" | sed -n 's#https://github.com/\([^/]*/[^/]*\)/.*#\1#p')
      url=$(gh api "repos/$slug_repo/issues/comments/$id" --jq .body 2>/dev/null |
        grep -o 'https://github.com/user-attachments/[^) ]*' | head -1 || true)
      echo "HOST github"
      echo "URL ${url:-<in the comment>}"
      echo "COMMENT $link"
      exit 0
    fi
  fi
fi

slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//' | cut -c1-40)
key="${pr:+pr$pr-}$(date +%Y%m%d-%H%M%S)-$slug.$ext"
url="$ENDPOINT/$BUCKET/$key"
if [ $dry -eq 1 ]; then
  echo "DRY upload $file as $type to $url"
else
  secret=$(security find-generic-password -a "$ACCESS_KEY" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null) ||
    die "no Keychain item '$KEYCHAIN_SERVICE'. Add it, or attach the file to Linear by hand."
  AWS_ACCESS_KEY_ID="$ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$secret" AWS_DEFAULT_REGION=us-east-1 \
    aws s3 cp "$file" "s3://$BUCKET/$key" --content-type "$type" --endpoint-url "$ENDPOINT" >/dev/null
  code=$(curl -s -o /dev/null -w '%{http_code}' -I "$url")
  [ "$code" = 200 ] || die "uploaded, but $url answers $code"
fi
echo "HOST minio"
echo "URL $url"

[ $comment -eq 1 ] && [ -n "$pr" ] || exit 0
if [ $dry -eq 1 ]; then
  echo "DRY comment on PR $pr:"
  body_for "$url" minio
  exit 0
fi
link=$(body_for "$url" minio | gh pr comment "$pr" ${repo_args[@]+"${repo_args[@]}"} --body-file -)
echo "COMMENT $link"

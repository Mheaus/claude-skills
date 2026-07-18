---
name: autopr
description: Create a branch + PR on the sakuga-software org, wait for a Copilot or Claude-agent review, apply the suggestions, reply to each comment, then play a macOS notification + sound when done.
argument-hint: [branch-name]
---

End-to-end flow: open a PR against the `sakuga-software` remote, request reviews from both `Copilot` and `anthropic-code-agent`, wait for the first review to land, apply coherent suggestions, reply to each comment, and trigger a macOS notification + system sound.

## Steps

### 1. Analyse the current state (parallel)
- `git status` — never use `-uall`
- `git diff` — staged + unstaged
- `git log --oneline -5` — match repo commit-message style
- `git remote -v` — find the remote pointing to a `sakuga-software/...` repo. That remote is the **target** (usually `origin`). If none matches, stop and ask the user.

### 2. Create the branch
- If `$ARGUMENTS` is provided, use it as branch name.
- Otherwise infer a short descriptive name with a conventional prefix: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `ci/`, `test/`.
- `git checkout -b <branch-name>`

### 3. Stage and commit
- Stage files explicitly — never `git add -A`.
- Never commit files that may contain secrets (.env, credentials, keys, …).
- Commit message in the repo's language and style, ending with:
  `Co-Authored-By: Claude <noreply@anthropic.com>`
- Use a HEREDOC.
- If pre-commit hooks fail, fix and create a **new** commit (never `--amend`, never `--no-verify`).

### 4. Push and open the PR
- `git push -u <sakuga-remote> <branch-name>`
- Extract `owner/repo` from the sakuga remote URL (e.g. `sakuga-software/jexplore-web`).
- Open the PR:
  ```bash
  gh pr create --repo <owner/repo> --title "<short title under 70 chars>" --body "$(cat <<'EOF'
  ## Summary
  <1-3 bullets>

  ## Test plan
  <bulleted checklist>

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```
- Capture the PR number and URL.

### 5. Request reviews from both bots
Some repos auto-review; some don't. Request both explicitly (ignore errors — one or both may not be collaborators).
```bash
gh api --method POST repos/<owner>/<repo>/pulls/<n>/requested_reviewers \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]' 2>/dev/null || true
gh api --method POST repos/<owner>/<repo>/pulls/<n>/requested_reviewers \
  -f 'reviewers[]=anthropic-code-agent' 2>/dev/null || true
```

### 6. Wait for the first review from either bot (Monitor)
**Login quirks — do not confuse these endpoints:**
- `/pulls/<n>/reviews` — review author logins: `copilot-pull-request-reviewer[bot]` and `anthropic-code-agent[bot]` (or `anthropic-code-agent`)
- `/pulls/<n>/comments` — line-comment author logins: `Copilot` and `anthropic-code-agent` (case matters)

Single immediate check first — skip the Monitor if a review is already there:
```bash
gh api repos/<owner>/<repo>/pulls/<n>/reviews \
  --jq '.[] | select(.user.login=="copilot-pull-request-reviewer[bot]" or (.user.login|startswith("anthropic-code-agent"))) | "\(.user.login) \(.state) \(.submitted_at)"'
```

If empty, start a Monitor that polls every 30s and exits on the first event:
```bash
# description: "PR <n>: waiting for Copilot/Claude review"
# timeout_ms: 900000   # 15 min cap
until out=$(gh api repos/<owner>/<repo>/pulls/<n>/reviews \
    --jq '.[] | select(.user.login=="copilot-pull-request-reviewer[bot]" or (.user.login|startswith("anthropic-code-agent"))) | "\(.user.login) \(.state) \(.submitted_at)"' 2>/dev/null) \
    && [ -n "$out" ]; do
  sleep 30
done
echo "$out"
```
If the Monitor times out, ask the user whether to proceed anyway. Do not fall back to a raw polling loop.

### 7. Fetch review comments from both bots
```bash
gh api repos/<owner>/<repo>/pulls/<n>/comments \
  --jq '.[] | select(.user.login=="Copilot" or .user.login=="anthropic-code-agent") | {id, user: .user.login, path, line, body}'
```
If there are no line comments, still fetch the review body (step 6 output includes it) to check for actionable text — otherwise inform the user and jump to step 11 (notification).

### 8. Analyse each comment
- Read the file referenced by the comment.
- Judge whether the suggestion is coherent (correctness, security, performance, missing input, etc.).
- Skip suggestions that are wrong, irrelevant, or would break things — note why.

### 9. Apply coherent fixes
- Edit files.
- Run relevant checks if feasible (`pnpm lint`, `pnpm typecheck`, `pnpm test`, etc.).

### 10. Commit, push, reply
- Stage files explicitly.
- Commit in the repo style, ending with `Co-Authored-By: Claude <noreply@anthropic.com>`. HEREDOC. If hooks fail → new commit.
- `git push`
- For **each** comment:
  - Applied → reply with the commit SHA + one-line description of the fix.
  - Skipped → reply explaining why.
  ```bash
  gh api repos/<owner>/<repo>/pulls/<n>/comments \
    -f body="<reply>" -F in_reply_to=<comment_id>
  ```

### 11. macOS notification + sound
Always fire this at the end — whether suggestions were applied, skipped, or absent. Run locally (you're on macOS / darwin):
```bash
osascript -e 'display notification "PR #<n>: <applied N / skipped M>" with title "autopr done" sound name "Glass"'
afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true
```
The `sound name "Glass"` in the notification already plays a sound, but `afplay` is a reliable fallback in case notifications are silenced in Focus mode.

### 12. Report to the user
- List each comment → applied (with SHA) or skipped (with reason).
- Include the PR URL and the final commit SHA.

## Important

- The sakuga-software remote is the **target**; never push to `upstream`/`jexplore` from this skill.
- Never apply a suggestion blindly — always read the surrounding code first.
- Never force-push, never `--no-verify`, never `--amend` after a failed hook.
- If `gh` is missing, stop and tell the user.
- If the PR already exists for the current branch, reuse it instead of creating a new one.

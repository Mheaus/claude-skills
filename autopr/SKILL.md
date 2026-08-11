---
name: autopr
description: Create a branch + PR on the sakuga-software org, wait for the review bots (all of them, including the late ones), apply the suggestions, reply to each comment, validate visually with /tfp when there is a surface to look at, then play a macOS notification + sound when done.
argument-hint: [branch-name]
---

End-to-end flow: open a PR against the `sakuga-software` remote, request reviews from both `Copilot` and `anthropic-code-agent`, apply coherent suggestions and reply to each comment — **for every reviewer, not just the first one to answer** — validate the change in a real browser when it has a visual surface, and trigger a macOS notification + system sound.

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
- Extract `owner/repo` from the sakuga remote URL (`git@github.com:sakuga-software/<repo>.git` → `sakuga-software/<repo>`).
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

### 6. Wait for the *first* bot review (Monitor)

**A first review is not *the* review.** Reviewers land minutes apart — in one measured case, seventeen — and this step used to exit on the first one and never look again, so a second reviewer's finding (a real functional defect) sat unread until the user ran `/ar` by hand. The fix is **step 10b**, not a longer wait here: work the first review immediately, then watch again once the fixes are pushed. That also catches the re-review the fix commit triggers.

**Never filter on a list of known bot names.** An allowlist silently drops whichever reviewer it has not heard of, and reports "no review" — which is indistinguishable from a review that found nothing. That has already cost a real functional defect, raised by a reviewer the list predated. Match on the `[bot]` suffix instead, so a reviewer added later is picked up without editing this file.

**Endpoint quirks worth knowing:**
- `/pulls/<n>/reviews` — bots appear with their full name, suffix included, e.g. `copilot-pull-request-reviewer[bot]`.
- `/pulls/<n>/comments` — the same bot may use a *different* login here: Copilot posts line comments as plain `Copilot`, with no suffix. Most others keep theirs, which is why the filter needs both forms.
- **The PR author appears on both**, including your own replies, so filter those out or you will re-process what you already answered.

Single immediate check first — skip the Monitor if a review is already there:
```bash
gh api repos/<owner>/<repo>/pulls/<n>/reviews \
  --jq '.[] | select(.user.login | endswith("[bot]")) | "\(.user.login) \(.state) \(.submitted_at)"'
```

If empty, start a Monitor that polls every 30s and exits on the first event:
```bash
# description: "PR <n>: waiting for a bot review"
# timeout_ms: 900000   # 15 min cap
until out=$(gh api repos/<owner>/<repo>/pulls/<n>/reviews \
    --jq '.[] | select(.user.login | endswith("[bot]")) | "\(.user.login) \(.state) \(.submitted_at)"' 2>/dev/null) \
    && [ -n "$out" ]; do
  sleep 30
done
echo "$out"
```
If the Monitor times out, ask the user whether to proceed anyway. Do not fall back to a raw polling loop.

### 7. Fetch the review comments

```bash
gh api repos/<owner>/<repo>/pulls/<n>/comments \
  --jq '.[] | select((.user.login | endswith("[bot]")) or .user.login == "Copilot")
            | select(.in_reply_to_id == null)
            | {id, user: .user.login, path, line, body}'
```
`in_reply_to_id == null` keeps only top-level comments — replies are yours or threaded follow-ups.

Also read the **review bodies** (step 6 output) and `gh pr checks <n>`: a review bot may post its finding in the body rather than on a line, and it may publish a **check of its own** that fails. A failing review check with no line comment still means there is something to answer.

If nothing actionable turns up anywhere, say so and go on to **10b** — a quiet first review is not a finished review, and the visual check in 10c is owed either way.

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

### 10b. Come back for the reviewers who were still thinking

The push you just made does two things: it answers the first reviewer, and it often triggers a fresh review of the new commit. Meanwhile a second bot may still be working on the original diff. So after pushing, watch again — this is where the wall-clock wait belongs, because the useful work is already done and on the branch.

Start a Monitor that reports the reviewer set and stops once it has been **quiet for 10 minutes**, capped at 25:
```bash
# description: "PR <n>: watching for late reviewers"
# timeout_ms: 1500000   # 25 min cap
reviewers() {
  gh api repos/<owner>/<repo>/pulls/<n>/reviews \
    --jq '.[] | select(.user.login | endswith("[bot]")) | "\(.user.login) \(.submitted_at)"' 2>/dev/null | sort -u
}
seen=$(reviewers); quiet=0
echo "already in: ${seen:-none}"
while [ "$quiet" -lt 600 ]; do
  sleep 30
  now=$(reviewers)
  if [ "$now" != "$seen" ]; then
    comm -13 <(echo "$seen") <(echo "$now")   # emit only what is new
    seen=$now; quiet=0
  else
    quiet=$((quiet + 30))
  fi
done
echo "quiet for 10 minutes, done watching"
```

If anything new lands, **go back to step 7** and run the loop again — fetch, judge, apply, push, reply — for the new comments only. `in_reply_to_id == null` plus "skip what I have already answered" is what keeps this from re-processing old threads.

Two rounds of this is the norm. If a third would start, stop and tell the user instead: a reviewer that keeps finding new things on every pass is a signal about the change, not a queue to drain.

### 10c. Look at it, when there is something to look at

A green check says the code does what the tests say. It does not say the thing looks right, and the tests are written by whoever also wrote the bug.

**If the change has a visual surface, validate it with `/tfp`** and post the recording to the PR. A visual surface means: this repo can serve a page that exercises the change — a dev server, a playground, a demo route, a component the app already renders. UI, overlays, layout, styling, anything a person would *look* at.

- Run `/tfp`, which drives Playwright's own Chromium, records the run, uploads it and comments on the PR. Follow that skill; do not reimplement it here.
- Drive the change **through its real UI**, not through injected JavaScript — a click on the button, not a call to the function behind it. Otherwise it validates the harness rather than the feature.
- Include the awkward states, not just the happy path: the empty case, the error, the thing that degrades.

**When there is no such surface** — a worker with no page, a library with no host, a pure refactor — say so plainly in the PR body under the test plan (`Not verified in a browser: <why>`) rather than quietly skipping it. That line is what tells the next person which risk is still open. If the change *should* have a surface and does not, that is worth a ticket of its own.

### 11. macOS notification + sound
Always fire this at the end — whether suggestions were applied, skipped, or absent. Run locally (you're on macOS / darwin):
```bash
osascript -e 'display notification "PR #<n>: <applied N / skipped M>" with title "autopr done" sound name "Glass"'
afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true
```
The `sound name "Glass"` in the notification already plays a sound, but `afplay` is a reliable fallback in case notifications are silenced in Focus mode.

### 12. Report to the user
- List each comment → applied (with SHA) or skipped (with reason), **grouped by reviewer**, so it is visible that more than one looked.
- Say how many review rounds there were, and whether the watch in 10b ended quiet or hit its cap — "no second reviewer showed up" and "I stopped waiting" are different facts.
- Include the PR URL, the final commit SHA, and the recording from 10c — or the one-line reason there is none.

## Important

- The sakuga-software remote is the **target**; never push to any other remote from this skill — not a fork, not an `upstream` pointing at a client's or vendor's org.
- Never apply a suggestion blindly — always read the surrounding code first.
- Never force-push, never `--no-verify`, never `--amend` after a failed hook.
- If `gh` is missing, stop and tell the user.
- If the PR already exists for the current branch, reuse it instead of creating a new one.
- **Never conclude on the first review alone.** Step 10b is not optional politeness towards slow bots; it is the step that caught a real defect the first reviewer missed.
- A recording is evidence, not decoration: if `/tfp` shows the feature misbehaving, fix it before finishing — do not publish the video and report success around it.

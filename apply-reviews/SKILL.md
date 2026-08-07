---
name: apply-reviews
description: Read the bot review comments on the current PR, apply coherent fixes, commit, push, and reply to each comment.
argument-hint: [pr-number]
---

Read the review comments left by **every** review bot on the current PR, apply the ones you judge coherent, commit and push, then reply to each comment with the detail of the fix.

## Steps

1. **Identify the PR**:
   - If `$ARGUMENTS` is provided, use it as the PR number
   - Otherwise, detect the current PR from the current branch: `gh pr view --json number,url,headRepository`
   - Determine the `owner/repo` from the PR metadata

2. **Wait for a bot review to land (using the Monitor tool)**:
   - **Never filter on a list of known bot names.** An allowlist silently drops whichever
     reviewer it has not heard of, and reports "no review" — indistinguishable from a review
     that found nothing. This skill used to name a single reviewer and missed another one's
     report of a real functional defect. Match on the `[bot]` suffix so a reviewer added later
     needs no edit here.
   - **Endpoint quirks:**
     - `/pulls/<n>/reviews` — bots appear under their full name, suffix included, e.g.
       `copilot-pull-request-reviewer[bot]`.
     - `/pulls/<n>/comments` — the same bot may use a *different* login: Copilot posts line
       comments as plain `Copilot`, with no suffix. Others keep theirs.
     - The **PR author appears on both**, your own replies included.
   - First do a single immediate check — if a review already exists, skip straight to step 3:
     ```bash
     gh api repos/<owner>/<repo>/pulls/<number>/reviews \
       --jq '.[] | select(.user.login | endswith("[bot]")) | "\(.user.login) \(.state)"'
     ```
   - If the check returns nothing, start a Monitor that polls every 30s and emits a single line
     the moment a bot submits a review. Exit the Monitor immediately after the first event:
     ```bash
     # description: "bot review on PR <n>"
     # timeout_ms: 600000   # 10 min cap
     until out=$(gh api repos/<owner>/<repo>/pulls/<number>/reviews \
         --jq '.[] | select(.user.login | endswith("[bot]")) | "\(.user.login) \(.state) \(.submitted_at)"' 2>/dev/null) \
         && [ -n "$out" ]; do
       sleep 30
     done
     echo "$out"
     ```
     The single stdout line is your notification — Monitor surfaces it and exits.
   - If the Monitor times out without an event, ask the user whether to proceed anyway or abort. Do not fall back to direct polling (silent loops burn context).

3. **Fetch the review comments**:
   ```bash
   gh api repos/<owner>/<repo>/pulls/<number>/comments \
     --jq '.[] | select((.user.login | endswith("[bot]")) or .user.login == "Copilot")
               | select(.in_reply_to_id == null)
               | {id, user: .user.login, path, line, body}'
   ```
   `in_reply_to_id == null` keeps only top-level comments — replies are yours or threaded
   follow-ups, and re-processing them wastes a round.
   - Also read the **review bodies** from step 2 and run `gh pr checks <number>`: a bot may put
     its finding in the body rather than on a line, and may publish a **check of its own** that
     fails. A failing review check with no line comment still means something needs answering.
   - If nothing actionable turns up anywhere, inform the user and stop.

4. **Analyse each comment**:
   - Read the comment body and the suggested change
   - Read the file referenced by the comment to understand the current code
   - Judge whether the suggestion is coherent and would improve the code (better cache correctness, missing inputs, security, performance, etc.)
   - Skip suggestions that are incorrect, irrelevant, or would break things — explain why you skipped them

5. **Apply coherent fixes**:
   - Edit the files to apply the accepted suggestions
   - Run any relevant formatters if the project uses one (check package.json scripts)
   - Verify the changes don't break anything by running the relevant checks (lint, typecheck, test, etc.) if feasible

6. **Commit and push**:
   - Stage modified files explicitly by name
   - Write a concise commit message summarizing what was fixed, following the repo's commit style
   - End the commit message body with: `Co-Authored-By: Claude <noreply@anthropic.com>`
   - Use a HEREDOC for the commit message
   - Push to the current tracking remote

7. **Reply to each Copilot comment on the PR**:
   - For each applied fix: reply with the commit SHA and a short description of what was changed
   - For each skipped suggestion: reply explaining why it was skipped
   - Use `gh api repos/<owner>/<repo>/pulls/<number>/comments -f body="<reply>" -F in_reply_to=<comment_id>`

8. **Report to the user**:
   - List each Copilot comment and whether it was applied or skipped (with reason)
   - Include the commit SHA and PR URL

## Important

- Never apply a suggestion blindly — read the surrounding code and understand the impact first.
- If the commit fails due to pre-commit hooks, fix the issues and create a NEW commit (do not amend).
- Never force push or use `--no-verify`.
- If a suggestion conflicts with another, pick the most coherent one and explain.

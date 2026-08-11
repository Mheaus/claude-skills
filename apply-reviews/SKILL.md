---
name: apply-reviews
description: Read the review comments from every bot on the current PR (waiting for the late ones too), apply coherent fixes, commit, push, reply to each comment, and validate in a browser when the fixes touched something visible.
argument-hint: [pr-number]
---

Read the review comments left by **every** review bot on the current PR — including the ones that
have not answered yet — apply the ones you judge coherent, commit and push, reply to each comment
with the detail of the fix, and look at the result in a browser when the fixes changed something
visible.

## Steps

1. **Identify the PR**:
   - If `$ARGUMENTS` is provided, use it as the PR number
   - Otherwise, detect the current PR from the current branch: `gh pr view --json number,url,headRepository`
   - Determine the `owner/repo` from the PR metadata

2. **Wait for a bot review to land (using the Monitor tool)**:
   - **A first review is not *the* review.** Reviewers land minutes apart — in one measured case,
     seventeen — and the second one's finding was a real functional defect. So this step collects
     *every* reviewer already present rather than stopping at "there is a review", and **step 8**
     comes back afterwards for the ones that were still thinking. Neither is optional.
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
   - First do a single immediate check. This skill is usually run *after* the fact, so reviews are
     often already in — list them **all** and carry the whole set into step 3, because working only
     the one you noticed is exactly the failure this step exists to prevent:
     ```bash
     gh api repos/<owner>/<repo>/pulls/<number>/reviews \
       --jq '.[] | select(.user.login | endswith("[bot]")) | "\(.user.login) \(.state) \(.submitted_at)"'
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
     The single stdout line is your notification — Monitor surfaces it and exits. Exiting on the
     first one is fine *here*, because step 8 does the waiting once the fixes are pushed and the
     wall-clock costs nothing.
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

8. **Come back for the reviewers who were still thinking**:
   - The push you just made answers the reviewers you had, and often triggers a fresh review of the
     new commit. Meanwhile a second bot may still be working on the original diff. Watch again now —
     the useful work is already on the branch, so the wait costs nothing but wall-clock.
   - Monitor until it has been **quiet for 10 minutes**, capped at 25, emitting only what is new:
     ```bash
     # description: "PR <n>: watching for late reviewers"
     # timeout_ms: 1500000   # 25 min cap
     reviewers() {
       gh api repos/<owner>/<repo>/pulls/<number>/reviews \
         --jq '.[] | select(.user.login | endswith("[bot]")) | "\(.user.login) \(.submitted_at)"' 2>/dev/null | sort -u
     }
     seen=$(reviewers); quiet=0
     echo "already in: ${seen:-none}"
     while [ "$quiet" -lt 600 ]; do
       sleep 30
       now=$(reviewers)
       if [ "$now" != "$seen" ]; then
         comm -13 <(echo "$seen") <(echo "$now")
         seen=$now; quiet=0
       else
         quiet=$((quiet + 30))
       fi
     done
     echo "quiet for 10 minutes, done watching"
     ```
   - If anything new lands, **go back to step 3** for the new comments only — `in_reply_to_id == null`
     plus "skip what I have already answered" keeps old threads from being re-processed.
   - Two rounds is the norm. Before starting a third, stop and tell the user: a reviewer that finds
     something new on every pass is saying something about the change, not filling a queue.

9. **Look at it, if the fixes touched something visible**:
   - A review comment applied to UI code deserves the same treatment as the feature itself: if this
     repo can serve a page that exercises what you changed, run **`/tfp`** and post the recording to
     the PR. Drive it through the real UI, and include the awkward state the comment was about.
   - If the fixes were server-side, internal, or there is no page to serve, say so in the report
     rather than skipping it silently.

10. **Report to the user**:
    - List each comment and whether it was applied or skipped (with reason), **grouped by
      reviewer**, so it is visible that more than one looked
    - Say how many rounds there were, and whether step 8 ended quiet or hit its cap — "nobody else
      reviewed" and "I stopped waiting" are different facts
    - Include the commit SHA, the PR URL, and the recording from step 9 (or why there is none)

## Important

- Never apply a suggestion blindly — read the surrounding code and understand the impact first.
- If the commit fails due to pre-commit hooks, fix the issues and create a NEW commit (do not amend).
- Never force push or use `--no-verify`.
- If a suggestion conflicts with another, pick the most coherent one and explain.
- **Never conclude on the first review alone.** Step 8 is the step that caught a defect the first
  reviewer had missed; treating it as optional is how that happens again.

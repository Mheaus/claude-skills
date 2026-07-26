---
name: test-feature
description: Test the current feature using Claude in Chrome browser automation. Reads recent git changes to understand what was built, finds the local dev server, and performs an interactive browser test with a recorded GIF.
argument-hint: [url]
allowed-tools: Bash Glob Read Grep mcp__claude-in-chrome__tabs_context_mcp mcp__claude-in-chrome__tabs_create_mcp mcp__claude-in-chrome__navigate mcp__claude-in-chrome__read_page mcp__claude-in-chrome__get_page_text mcp__claude-in-chrome__find mcp__claude-in-chrome__form_input mcp__claude-in-chrome__javascript_tool mcp__claude-in-chrome__computer mcp__claude-in-chrome__gif_creator mcp__claude-in-chrome__read_console_messages mcp__claude-in-chrome__read_network_requests mcp__claude-in-chrome__shortcuts_execute
---

Test the current feature end-to-end in a real Chrome browser.

## Steps

### 1. Understand what was built

Run these in parallel to understand the feature under test:

- `git diff HEAD~1 --stat` — list files changed
- `git log --oneline -5` — recent commit context
- `git diff HEAD~1 -- '*.tsx' '*.ts' '*.vue' '*.svelte' '*.jsx' '*.js'` — see the actual code changes (skip lockfiles, generated files)

Read the diffs to identify:
- What UI was added or changed (new routes, components, forms, modals, buttons)
- What actions the feature enables (e.g. "user can submit a form", "filters now update a list")
- Any error states or edge cases visible in the code

### 2. Find the dev server URL

If `$ARGUMENTS` was provided, use it as the URL directly (skip this step).

Otherwise, detect where the app is running:

1. Check for a running dev server — look for common ports:
   ```
   lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | grep -E ':(3000|3001|4000|4200|5173|5174|5175|5200|8080|8000|8888|9000)\s' | head -5
   ```
   Note: Suricarte's dedicated Claude Code port is **5200** (avoid conflicts with other projects on 5173–5175).
2. Fall back to config files — check `package.json`, `.env`, `.env.local`, `vite.config.*`, `next.config.*` for port or base URL settings.
3. If still unclear, ask the user: "What URL should I test? (e.g. http://localhost:3000)"

### 3. Load Chrome tools

Before any browser interaction, load the required tools via ToolSearch:
```
select:mcp__claude-in-chrome__tabs_context_mcp
```

Then load additional tools as needed:
```
select:mcp__claude-in-chrome__tabs_create_mcp
select:mcp__claude-in-chrome__navigate
select:mcp__claude-in-chrome__gif_creator
```

### 4. Start recording & open the app

1. Call `mcp__claude-in-chrome__tabs_context_mcp` first to sync with the current tab group.
2. **Always create a FRESH tab** with `mcp__claude-in-chrome__tabs_create_mcp` and work in it — do **not** reuse a tab id from a previous turn/session even if it shows the dev URL. Stale tabs are the #1 cause of `Permission denied by user` and `Tab … no longer exists` errors, and tab ids can silently change between calls (re-read them from each tool result). Only reuse an existing tab if the user explicitly asks.
3. Start a GIF recording with `mcp__claude-in-chrome__gif_creator` (pass the fresh `tabId`). Name the file after the feature (e.g. `test_user_filter.gif`). Capture extra frames at the start and end for smooth playback.
4. Navigate to the dev server URL (or the specific route where the feature lives, if known from the diff).

**If a browser action returns `Permission denied by user` or a stale/invalid-tab error:** don't repeat the same call. Re-run `tabs_context_mcp`, create a NEW tab with `tabs_create_mcp`, and retry the action on that fresh tab id (once).

#### `Permission denied by user` on navigate — often MISLEADING, retry first

This error is **known to be misleading and frequently transient**. It does **not** reliably mean the user actually denied anything, nor that extension site access is off — the *same* `navigate` call often just **succeeds on a later retry with no change on the user's side** (observed 2026-07-26: denied twice, then went through on the next attempt with nothing granted).

So treat a denial as "try again", not "the user must fix their settings":

1. **Retry the navigation a few times** (2–4), each on a **fresh tab** via `tabs_context_mcp` + `tabs_create_mcp`. Space the attempts out (e.g. across turns) rather than firing the identical call back-to-back. This alone clears most cases.
2. **Do not** immediately tell the user to change extension permissions — that was the wrong first move; leading with retries is right.
3. Only if it **persists across several fresh-tab retries** may you mention, as a *possible* cause, that the Claude Chrome extension's site access could be off for that origin (site access is per origin *and* port, so `:5173` ≠ `:5200`) — they can check via the extension icon → site access, or `chrome://extensions` → Claude → Site access. Frame it as "possibly, the message is often misleading", and still retry after.
4. If it never succeeds after all that, stop and report — don't keep looping `navigate` in a tight cycle.

### 5. Exercise the feature

Based on what you learned in step 1, interact with the feature:

- **Happy path first** — perform the main action the feature enables (fill a form, click a button, apply a filter, etc.)
- **Verify the result** — read the page / check the DOM / watch network requests to confirm the expected outcome occurred
- **Edge cases** — test at least one edge case visible in the code (empty state, validation error, loading state, disabled button, etc.)
- **Navigation** — if the feature spans multiple pages/routes, navigate through the full flow

Use these tools as needed:
- `mcp__claude-in-chrome__find` — locate elements by selector or text
- `mcp__claude-in-chrome__form_input` — type into inputs, select options, check checkboxes
- `mcp__claude-in-chrome__shortcuts_execute` — keyboard shortcuts
- `mcp__claude-in-chrome__javascript_tool` — read state, trigger events, or check values that aren't visible in the DOM
- `mcp__claude-in-chrome__read_console_messages` — watch for JS errors (use pattern `"error"` or `"Error"`)
- `mcp__claude-in-chrome__read_network_requests` — verify API calls fired and returned expected status codes
- `mcp__claude-in-chrome__computer` — take a screenshot at key moments

### 6. Stop recording

Stop the GIF recording (`gif_creator` action `stop_recording`). This freezes the captured frames but doesn't produce a file yet — export happens in the next step, targeted at wherever the GIF needs to land.

### 7. Export the GIF, then upload to Linear (default) or the PR (public repos only)

Export with `gif_creator` `action: "export"`, `download: true`, and a descriptive `filename` (e.g. `test_user_filter.gif`). This saves the GIF to `~/Downloads/<filename>.gif` — no further browser interaction needed.

**Linear is the default target.** GitHub has no public API for uploading a binary straight into a PR comment — the paste/drag-drop upload in the web UI hits an internal, session-only endpoint that `gh`/`git` can't reach. A `raw.githubusercontent.com` link pinned to a commit *looks* like a workaround, but only actually renders for **public** repos: for private repos that domain requires an `Authorization` header on every request, which a viewer's browser never sends just from being logged into github.com (verified: 404 without a token, 200 with one) — so the image would show as broken to anyone opening the PR. The only URLs that render inline for a private repo without extra auth are the ones GitHub itself issues through its authenticated upload flow (browser drag-drop or the internal API), neither of which is available here.

1. Check whether a PR exists **and** whether the repo is public:
   ```bash
   PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null)
   IS_PRIVATE=$(gh repo view --json isPrivate -q .isPrivate 2>/dev/null)
   ```

2. **If a PR exists and the repo is public** (`IS_PRIVATE` = `false`), publish the GIF via plumbing commands to a dedicated `test-recordings` branch (no checkout, no `git add`, nothing touches the current branch) and link it with a raw URL — this only works because public raw URLs don't require auth:
   ```bash
   GIF_PATH=~/Downloads/<filename>.gif
   OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
   BRANCH=test-recordings
   SLUG="pr${PR_NUMBER}-$(date +%Y%m%d-%H%M%S)-<feature-slug>.gif"

   BLOB_SHA=$(git hash-object -w "$GIF_PATH")

   if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
     git fetch origin "$BRANCH":"refs/remotes/origin/$BRANCH" -q
     PARENT_SHA=$(git rev-parse "refs/remotes/origin/$BRANCH")
     BASE_TREE=$(git rev-parse "$PARENT_SHA^{tree}")
     TREE_SHA=$( { git ls-tree "$BASE_TREE"; printf '100644 blob %s\t%s\n' "$BLOB_SHA" "$SLUG"; } | git mktree )
     NEW_COMMIT=$(git commit-tree "$TREE_SHA" -p "$PARENT_SHA" -m "Add test recording for PR #$PR_NUMBER")
   else
     TREE_SHA=$(printf '100644 blob %s\t%s\n' "$BLOB_SHA" "$SLUG" | git mktree)
     NEW_COMMIT=$(git commit-tree "$TREE_SHA" -m "Add test recording for PR #$PR_NUMBER")
   fi

   git push origin "$NEW_COMMIT:refs/heads/$BRANCH"

   RAW_URL="https://raw.githubusercontent.com/${OWNER_REPO}/${NEW_COMMIT}/${SLUG}"
   gh pr comment "$PR_NUMBER" --body "$(printf '### Test recording\n\n![%s](%s)\n' "<feature name>" "$RAW_URL")"
   ```
   Confirm the comment posted (`gh pr view --json comments` or the URL `gh pr comment` prints) and note it for the report.

3. **In every other case — private repo, push failure, or no PR — upload to Linear:**
   - Get the exact size: `wc -c < ~/Downloads/<filename>.gif`.
   - Load the Linear MCP tools:
     ```
     ToolSearch: select:mcp__claude_ai_Linear__list_issues,mcp__claude_ai_Linear__save_issue,mcp__claude_ai_Linear__prepare_attachment_upload,mcp__claude_ai_Linear__create_attachment_from_upload,mcp__claude_ai_Linear__list_teams
     ```
   - Search for an existing issue: `mcp__claude_ai_Linear__list_issues` with `query: "<feature name>"`.
   - If none found, create one with `mcp__claude_ai_Linear__save_issue` (team: from `list_teams`, title: the feature name, state: "Done", add a PR link if available).
   - Upload: call `prepare_attachment_upload` with `issue`, `filename`, `contentType: "image/gif"`, `size` (exact bytes). This returns a signed `uploadRequest.url`.
   - PUT the file immediately (signed URL expires in 60s):
     ```bash
     curl -s -X PUT --data-binary @~/Downloads/<filename>.gif \
       -H "content-type: image/gif" \
       -H "cache-control: public, max-age=31536000" \
       -H "x-goog-content-length-range: <size>,<size>" \
       -H 'Content-Disposition: attachment; filename="<filename>.gif"' \
       "<uploadRequest.url>"
     ```
   - Finalize: call `create_attachment_from_upload` with `issue` and `assetUrl`.
   - Include the Linear issue URL in the test report.

### 8. Report results

Write a concise test report:

```
## Test report — <feature name>

**URL tested:** <url>
**GIF:** uploaded to <Linear issue URL or PR link>

### Passed
- <what worked correctly>

### Issues found
- <bug or unexpected behaviour, with steps to reproduce>
  - Console errors: <paste relevant errors>
  - Network: <unexpected status codes>

### Not tested
- <edge cases you could not reach>
```

If no issues were found, say so clearly. Do not pad the report with filler.

## Important

- Never trigger JavaScript `alert()`, `confirm()`, or `prompt()` — these block the browser extension. Use `console.log` + `read_console_messages` instead.
- If the dev server is not running, tell the user and stop — do not attempt to start it.
- If a browser tool fails 2–3 times, stop and ask the user for guidance rather than retrying in a loop.
- Always start from a fresh tab (step 4); never trust a tab id carried over from an earlier turn/session.
- Do not navigate to unrelated pages.
- Do not modify, stage, or commit anything on the current branch or working tree — the only git writes this skill performs are the plumbing commands in step 7, which write directly to the separate `test-recordings` branch and never touch `HEAD`, the index, or the branch under test.
- Step 7's push and PR comment are real, visible actions on a shared remote. If it's unclear whether the push or comment actually landed, verify with `gh pr view --json comments` before reporting success rather than assuming.

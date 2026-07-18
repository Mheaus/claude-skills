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

**If a browser action returns `Permission denied by user` or a stale/invalid-tab error:** don't repeat the same call. Re-run `tabs_context_mcp`, create a NEW tab with `tabs_create_mcp`, and retry the action on that fresh tab id (once). If it still fails, the extension's site access for the dev host is off — ask the user to re-enable it (extension icon → site access, or `chrome://extensions` → Claude → "On all sites") and stop; do not loop.

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

Stop the GIF recording. The path will be returned — share it with the user.

### 7. Upload GIF to GitHub PR or Linear

After stopping the recording, upload the GIF to the current PR or a Linear ticket:

1. **Find the GIF on disk** — the GIF downloads to `~/Downloads/<filename>.gif`. Get its size: `wc -c < ~/Downloads/<filename>.gif`.

2. **Try GitHub PR first** — check if a PR exists for the current branch:
   ```bash
   gh pr view --json number,url 2>/dev/null
   ```
   If a PR exists, post the GIF as a PR comment using a markdown image. GitHub doesn't support direct binary uploads via CLI, so use Linear instead.

3. **Upload to Linear** — load the Linear MCP tools:
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

4. Include the Linear issue URL in the test report.

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
- Do not commit, push, or modify any files as part of this skill.

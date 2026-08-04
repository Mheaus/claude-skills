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
   lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | grep -E ':(3000|3001|4000|4200|517[0-9]|52[0-9]{2}|8080|8000|8888|9000)\s' | head -5
   ```
   Many repos pin a dedicated port for Claude Code sessions so a session never collides with the port the user is already on — check the repo's `CLAUDE.md` before assuming the framework default.
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
2. **Create a FRESH tab** with `mcp__claude-in-chrome__tabs_create_mcp` and work in it — do **not** reuse a tab id from a **previous session** even if it shows the dev URL. Stale (cross-session) tabs are the #1 cause of `Permission denied by user` and `Tab … no longer exists` errors, and tab ids can silently change between calls (re-read them from each tool result). **Exception:** a tab you *successfully navigated to the target origin earlier in this same session* is not stale — reusing it is fine and avoids re-triggering the denial loop (see the `Permission denied` section below). Otherwise start fresh.
3. Start a GIF recording with `mcp__claude-in-chrome__gif_creator` (pass the fresh `tabId`). Name the file after the feature (e.g. `test_user_filter.gif`). Capture extra frames at the start and end for smooth playback.
4. Navigate to the dev server URL (or the specific route where the feature lives, if known from the diff).

**If a browser action returns `Permission denied by user` or a stale/invalid-tab error:** don't repeat the same call. Re-run `tabs_context_mcp`, create a NEW tab with `tabs_create_mcp`, and retry the action on that fresh tab id (once).

#### `Permission denied by user` on navigate — often MISLEADING, retry first

This error is **known to be misleading and frequently transient**. It does **not** reliably mean the user actually denied anything, nor that extension site access is off — the *same* `navigate` call often just **succeeds on a later retry with no change on the user's side** (observed 2026-07-26: denied twice, then through on the next try; observed 2026-08-02: denied **three** times, then through on the **4th** fresh tab — nothing granted in between).

So treat a denial as "try again", not "the user must fix their settings":

0. **First, reuse — don't fight.** If you *already* navigated a tab to the target origin **earlier in this same session** (e.g. an initial layout check before recording), just keep working in that tab: it's already past the permission gate, so reusing it sidesteps the denial loop entirely. The "always a fresh tab" rule in step 4 guards against **cross-session / stale** tab ids — it is *not* a reason to abandon a tab you successfully drove minutes ago and re-provoke the denial. (Only caveat: a GIF recording is scoped to its tab group, so start/stop the recording in whichever tab you settle on.)
1. **Each retry is a brand-new fresh tab.** Retrying the *same* denied tab tends to keep failing; creating a *new* tab via `tabs_context_mcp` + `tabs_create_mcp` for each attempt is what actually clears it. Budget **up to ~4** attempts (this has been needed), and space them out (across turns) rather than firing the identical call back-to-back.
2. **Do not** immediately tell the user to change extension permissions — that was the wrong first move; leading with retries is right.
3. Only if it **persists across several fresh-tab retries** may you mention, as a *possible* cause, that the Claude Chrome extension's site access could be off for that origin (site access is per origin *and* port, so `:5173` ≠ `:5200`) — they can check via the extension icon → site access, or `chrome://extensions` → Claude → Site access. Frame it as "possibly, the message is often misleading", and still retry after.
4. If it never succeeds after all that, stop and report — don't keep looping `navigate` in a tight cycle.

##### Prefer in-page navigation for same-origin route changes

After the first `navigate`-tool load of the origin, drive subsequent same-origin route changes from inside the page — either a `computer` click on an in-app `<Link>` (client-side SPA nav, the normal way to exercise the feature), or `javascript_tool` running `window.location.assign('http://localhost:PORT/route'); 'ok'`. Use `javascript_tool` only for that `location.assign` call; read and verify page state with the dedicated tools (`screenshot`, `read_page`, `get_page_text`, `find`, `read_console_messages`) rather than reading the DOM through JS. (The GIF recorder captures only `navigate`/`computer` actions, so `location.assign` hops aren't frames — take a `computer` screenshot after each to add one.)

> **Separate, unrelated gotcha (not a permission issue):** `resize_window` reports success but the **captured viewport can stay pinned** at its earlier size (observed 2026-08-02, stuck ~1474px), so screenshots/GIF frames may not reflect a resize. Don't burn attempts chasing it — if you need to show a responsive breakpoint you can't capture, demonstrate it another way (interact at the width you *can* capture) and note the responsive behavior was verified by class logic, not on video.

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

### 7. Export the GIF and publish it to MinIO, then link it from the PR or Linear

Export with `gif_creator` `action: "export"`, `download: true`, and a descriptive `filename` (e.g. `test_user_filter.gif`). This saves the GIF to `~/Downloads/<filename>.gif` — no further browser interaction needed.

GIFs are hosted on a self-hosted MinIO instance (`s3.deploy.sakuga.dev`, Dokploy project `devtools` on `em-sakuga-01`), in a `public` bucket with an anonymous-read (`GetObject`-only, no listing) policy. This gives a plain public URL that works identically for public and private repos — unlike `raw.githubusercontent.com`, which 404s for private repos without an auth header, and unlike GitHub's own drag-drop upload, which has no CLI/API equivalent.

1. Get the uploader secret from the macOS Keychain (never hardcode it, never print it in the report):
   ```bash
   MINIO_SECRET=$(security find-generic-password -a "test-feature-uploader" -s "sakuga-minio-test-feature-uploader" -w)
   ```
   The access key itself isn't secret: `test-feature-uploader`. If the Keychain lookup fails (item missing, e.g. on a machine that hasn't been set up), fall back to Linear (step 4 below) and tell the user to add the credential.

2. Upload with a unique key so recordings never collide, then link it:
   ```bash
   PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null)
   KEY="${PR_NUMBER:+pr${PR_NUMBER}-}$(date +%Y%m%d-%H%M%S)-<feature-slug>.gif"

   AWS_ACCESS_KEY_ID="test-feature-uploader" AWS_SECRET_ACCESS_KEY="$MINIO_SECRET" AWS_DEFAULT_REGION="us-east-1" \
     aws s3 cp ~/Downloads/<filename>.gif "s3://public/$KEY" --endpoint-url https://s3.deploy.sakuga.dev

   PUBLIC_URL="https://s3.deploy.sakuga.dev/public/$KEY"
   ```
   The object key includes a timestamp and isn't guessable, and the bucket doesn't allow anonymous listing — so this is "unlisted", not indexed/discoverable, even though it's not access-controlled to repo collaborators the way a GitHub-native upload would be. Don't upload anything more sensitive than a UI test recording through this path.

3. **If a PR exists**, post it as a comment:
   ```bash
   gh pr comment "$PR_NUMBER" --body "$(printf '### Test recording\n\n![%s](%s)\n' "<feature name>" "$PUBLIC_URL")"
   ```
   Confirm the comment posted (`gh pr view --json comments`) and note the comment URL for the report.

4. **If no PR exists**, attach it to a Linear issue instead (keeps a durable, searchable home for the recording):
   - Load the Linear MCP tools: `ToolSearch: select:mcp__claude_ai_Linear__list_issues,mcp__claude_ai_Linear__save_issue,mcp__claude_ai_Linear__save_comment,mcp__claude_ai_Linear__list_teams`
   - Search for an existing issue: `list_issues` with `query: "<feature name>"`. If none found, create one with `save_issue` (team from `list_teams`, title: the feature name, state: "Done").
   - Post `save_comment` on that issue with body `![<feature name>](<PUBLIC_URL>)`.
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
- Do not modify, stage, or commit anything on the current branch or working tree. This skill's only writes are the MinIO upload and the PR comment / Linear comment in step 7.
- Step 7's PR comment (or Linear comment) is a real, visible action. If it's unclear whether it actually landed, verify with `gh pr view --json comments` before reporting success rather than assuming.
- Never print the MinIO uploader secret in output, logs, or the test report — only pull it into a shell variable via `security find-generic-password`.

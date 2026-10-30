# Driver: Claude in Chrome

Use it for `/tf`, for `chrome` in the arguments, or when Playwright cannot reach the page (a
page behind the user's own browser session, an extension installed in Chrome). For everything
else, Playwright is faster and has none of the traps below.

## Steps

1. Load the tools in one call:
   `ToolSearch select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__form_input,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__gif_creator,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__javascript_tool`
2. `tabs_context_mcp`, then a **new tab** with `tabs_create_mcp`. Read the tab id from each result.
3. `gif_creator` start, with the tab id. Capture some frames before the first action.
4. `navigate` to the page, then drive it with `computer`, `find`, `form_input`. Read errors with
   `read_console_messages` (pattern `error`) and `read_network_requests`.
5. `gif_creator` stop, then export with `download: true` and a `filename`: the file goes to
   `~/Downloads/<filename>.gif`. Publish it with `scripts/publish.sh`.

## Traps

- **A tab id of an earlier session is stale.** It gives `Tab … no longer exists` or
  `Permission denied by user`. A tab that you navigated to the same origin earlier in this session
  is good: keep it, it is already past the permission gate.
- **`Permission denied by user` on `navigate` is often false.** Seen several times: refused two to
  three times, then through on the next new tab, with no change from the user. Retry on a new tab
  each time, up to four times. Only then say that the site access of the extension can be off for
  that origin and port (`chrome://extensions` → Claude → Site access).
- **The GIF records `navigate` and `computer` actions only.** For a route change in the same
  origin, click a link of the app, or run `window.location.assign(url)` with `javascript_tool`,
  then take a `computer` screenshot to add a frame.
- **`resize_window` can report a success and keep the old size** in the captures. Do not chase it:
  test at the width you can capture, and say so in the report.
- **Never trigger `alert`, `confirm` or `prompt`.** A dialog blocks the extension. If a button
  opens one, warn the user before you click it.
- If a tool fails two or three times in the same way, stop and ask the user.

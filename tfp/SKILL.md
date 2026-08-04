---
name: tfp
description: Shorthand alias for the test-feature-pw skill — end-to-end feature test via a Playwright script (no Chrome extension / no permission gate) with a GIF attached to the PR.
---

`/tfp` is a shorthand alias for the **`test-feature-pw`** skill. There is one source of truth — do not duplicate the steps here.

Invoke the `test-feature-pw` skill via the Skill tool (`Skill(skill: "test-feature-pw", args: "<args>")`) and follow it exactly, forwarding any `<args>` through (e.g. an explicit URL, or the word `headed` to run with a visible browser window).

Why this exists: it drives Playwright's own Chromium from a Node script, so it sidesteps the Claude-in-Chrome permission gate ("Permission denied by user") and the 500px `resize_window` viewport-pinning that repeatedly slow down `/tf`. Prefer `/tfp` when the extension gate is misbehaving; prefer `/tf` for quick interactive exploration.

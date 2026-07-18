---
name: tf
description: Shortcut for /test-feature — test the current feature end-to-end in a real Chrome browser (git diff → find dev server → drive the app → recorded GIF → upload to the PR/Linear). Use when the user types /tf.
argument-hint: [url]
---

`/tf` is a shorthand alias for the **`test-feature`** skill. There is one source of truth — do not duplicate the steps here.

Invoke the `test-feature` skill via the Skill tool (`Skill(skill: "test-feature", args: "$ARGUMENTS")`) and follow it exactly, forwarding any `$ARGUMENTS` (e.g. an explicit URL) through.

Reminder of the two things that most often go wrong (both handled in `test-feature`): always drive a **fresh tab** (never a stale tab id from a previous turn), and if a browser action is denied or the tab is invalid, re-read `tabs_context_mcp`, open a new tab, retry once, then stop and ask rather than looping.

---
name: tf
description: Shortcut for /test-feature with the Claude in Chrome driver — test the current change in the user's Chrome, record it, post it to the PR or Linear. Use when the user types /tf.
argument-hint: "[url]"
---

Invoke the `test-feature` skill with `Skill(skill: "test-feature", args: "chrome $ARGUMENTS")` and
follow it. The one source of truth is `test-feature`: do not repeat its steps here.

---
name: tfp
description: Shortcut for /test-feature with its default drivers (Playwright for a page, the shell for a CLI or an API) — start the dev environment, test the current change through its real interface, record it, post it to the PR, stop the environment. Use when the user types /tfp.
argument-hint: "[url | command] [headed]"
---

Invoke the `test-feature` skill with `Skill(skill: "test-feature", args: "$ARGUMENTS")` and follow
it. The one source of truth is `test-feature`: do not repeat its steps here.

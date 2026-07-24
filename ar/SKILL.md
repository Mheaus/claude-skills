---
name: ar
description: Shortcut for /apply-reviews — read GitHub Copilot's review comments on the current PR, apply coherent fixes, commit, push, and reply to each comment. Use when the user types /ar.
argument-hint: [pr-number]
---

`/ar` is a shorthand alias for the **`apply-reviews`** skill. There is one source of truth — do not duplicate the steps here.

Invoke the `apply-reviews` skill via the Skill tool (`Skill(skill: "apply-reviews", args: "$ARGUMENTS")`) and follow it exactly, forwarding any `$ARGUMENTS` (e.g. an explicit PR number) through.

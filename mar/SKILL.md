---
name: mar
description: Shortcut for /monitor-apply-reviews — stay on the current PR until it is green, applying each review round as it lands, fixing failing checks, and asking idle reviewers for a pass. Use when the user types /mar.
argument-hint: [pr-number]
---

`/mar` is a shorthand alias for the **`monitor-apply-reviews`** skill. There is one source of truth — do not duplicate the steps here.

Invoke the `monitor-apply-reviews` skill via the Skill tool (`Skill(skill: "monitor-apply-reviews", args: "$ARGUMENTS")`) and follow it exactly, forwarding any `$ARGUMENTS` (e.g. an explicit PR number) through.

Use `/ar` instead when one or two rounds are wanted and the user will take it from there; `/mar` keeps going until the checks are green and no review still asks for changes.

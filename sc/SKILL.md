---
name: sc
description: Shortcut for /simplify-comments — rewrite the comments of the current change in ASD-STE100 simplified technical English, consolidate the overlapping ones, delete the ones that restate the code. Use when the user types /sc.
argument-hint: [paths]
---

`/sc` is a shorthand alias for the **`simplify-comments`** skill. There is one source of truth — do not duplicate the steps here.

Invoke the `simplify-comments` skill via the Skill tool (`Skill(skill: "simplify-comments", args: "$ARGUMENTS")`) and follow it exactly, forwarding any `$ARGUMENTS` (e.g. explicit paths) through.

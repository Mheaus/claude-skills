---
name: next
description: Like /wn, but fully autonomous — the PR you just opened has been merged; sync main, find the available Linear tasks, pick the best one yourself, start it (branch + implement), and once verified chain straight into /autopr WITHOUT asking the user.
argument-hint: [project-name]
---

The PR from the current branch has just been **merged**. Unlike `/wn` (which asks), `next` picks the best available task itself and gets to work — no "which one?" question.

## Steps

### 1–3. Discover (same as `/wn`)
1. Sync main: `git checkout main && git pull origin main` (the merged commit is now on `main`).
2. Determine the active Linear project — `$ARGUMENTS` if given, else the project of the work just merged (in this repo: **"Rapports & Stats V1"**, team **Jexplore**).
3. List Todo issues via the Linear MCP (`mcp__claude_ai_Linear__list_issues(project, state: "Todo", limit: 30)`; load it with ToolSearch `select:mcp__claude_ai_Linear__list_issues,mcp__claude_ai_Linear__get_issue` if needed). Ignore anything whose PR already merged onto `main`.

### 4. Pick the best task (your call — do NOT ask)
Rank by, in order:
1. **Unblocked** — skip anything that "dépend de tous les autres lots" / is gated on other work (e.g. a client-recette/release ticket). Those go last.
2. **Priority** — honour Urgent/High first when set.
3. **Continuity + value** — prefer tasks that build on the code you're already deep in, and small/medium well-scoped tickets over large refactors or pure-docs/DX chores, unless those are higher priority.

State the pick in one line with a one-line rationale, then start.

### 5. Start it
- `mcp__claude_ai_Linear__get_issue(<id>)` for the full description + `gitBranchName`.
- Create the branch from Linear's suggested name: `git checkout -b <gitBranchName>`.
- Implement, following the repo conventions (CLAUDE.md), and verify (typecheck/lint/test, and a browser check when it's UI).
- **Open questions in the ticket:** since this is autonomous, don't stall — make the sensible default, implement it, and clearly flag the decision in your summary and in the eventual PR body so the user can override.

### 6. Ship it — chain into `/autopr`
Once the task is implemented and verified (typecheck/lint/test green, browser-checked when UI):
1. Commit the work locally on the task branch (repo commit style, `Co-Authored-By: Claude <noreply@anthropic.com>`).
2. **Invoke the `/autopr` skill** to push, open the PR against the `sakuga-software` remote, request both bot reviews, wait for the first review, apply coherent suggestions, reply to each comment, and fire the macOS notification. Follow its steps in full — do not re-implement them here.
3. After `/autopr` completes, summarise: what you built, the decisions you made (with defaults you chose for any open questions), the PR URL, and which review suggestions were applied/skipped.

This is the one exception to "outward actions need a go-ahead": running `/next` **is** the go-ahead to take the task all the way to an open, review-processed PR.

## Important
- Autonomy covers the whole loop: *which task*, *how to build it*, **and** shipping it via `/autopr`. The only thing you don't do autonomously is **merge** — that stays the user's call.
- Never merge the PR. Never force-push, `--no-verify`, or `--amend` after a failed hook (see `/autopr`).
- If no task is clearly startable (all blocked, or the best pick needs a product decision you can't reasonably default), fall back to `/wn` behaviour: report and ask — and do NOT open a PR.
- If verification fails and you can't get it green, stop before `/autopr`: report the blocker instead of opening a broken PR.
- Match the user's language (French).

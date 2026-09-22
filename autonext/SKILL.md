---
name: autonext
description: Chain /next runs without a human in between — pick a Linear task, claim it, build it, ship it through /autopr and /mar, then take the next one, stacking PRs on top of each other when the work depends on an unmerged PR. Stops when no ticket can be taken autonomously or when the next PR cannot be stacked.
argument-hint: [project-name] [max-stack=<n>]
---

`/next` takes **one** task after a merge. **`/autonext` keeps taking tasks** until it cannot take
another one. It does not wait for a merge: when the next task needs code that is not on `main` yet,
it stacks the new PR on the PR that has that code.

Every step of one task is the `next` skill. Read it and follow it for each task: the ranking, the
claim in Linear, the implementation, `/tfp` after a significant UI change, `/autopr`, then `/mar`.
This file adds only the loop, the choice of the base branch, and the conditions to stop.

Running `/autonext` is the go-ahead for everything `/next` does, for each task of the run. It is not
a go-ahead to merge. **Never merge.**

## Arguments

- A **project name** — passed to each `/next` iteration.
- **`max-stack=<n>`** — the maximum number of unmerged PRs of this run in one stack. Default: **3**.
  A deeper stack costs a rebase for each PR above a merge, and a finding low in the stack moves
  everything above it.

## The run ledger

Keep a ledger in the scratchpad directory (`autonext-ledger.md`) and update it after each step. The
context can be summarized, and the ledger is what lets the loop continue. A new session does not see
the scratchpad of the old one: then build the ledger again from GitHub
(`gh pr list --author @me --state open --json number,headRefName,baseRefName`) and from the Linear
tickets in `In Progress` assigned to you.

| Ticket | Branch | Base | PR | State |
|---|---|---|---|---|
| ABC-12 | abc-12-… | main | #101 | green |
| ABC-15 | abc-15-… | abc-12-… | #103 | waiting: reviewer quota until 16:26 |

States: `building`, `open`, `green`, `waiting: <why>`, `blocked: <why>`, `merged`.

## The loop

### 1. Take stock

1. `git fetch origin`. For each PR of the ledger, read `state`, `mergedAt` and `baseRefName`
   (`gh pr view <n> --json state,mergedAt,baseRefName,headRefName`).
2. **A PR of the stack merged:** move each PR directly above it to `main` (step 4, "After a merge").
3. **A PR of the ledger waits for a return time that is now past** (a reviewer quota, a check): go
   back to it with `/mar` first. Finish what you owe before you start something new.
4. Read the comments of people on each open PR of the ledger (`pr-signals.sh`, lines tagged
   `human`). An instruction such as "stop", "wait" or "do not stack on this" applies to the whole
   run.

### 2. Pick and claim the next task

Do `next` steps 2 to 4b: list the `Todo` tickets, rank them, claim the best one. Add these rules:

- **Skip a ticket that needs code from an unmerged PR that is not yours.** You cannot stack on the
  work of another agent or of a person.
- **Skip a ticket that needs a product decision.** `/next` accepts a sensible default for a small
  open question. `/autonext` stacks work on that default, so a wrong default costs every PR above it.
  If the choice changes what a user sees or what a figure means, leave the ticket in `Todo`.
- **Prefer a ticket that does not need the stack.** A PR on `main` can merge alone; a stacked PR
  waits for everything below it.

### 3. Choose the base

| The task | Base |
|---|---|
| Needs no code from the open PRs of the ledger | `origin/main` |
| Needs the code of one open PR of the ledger | The branch of that PR. Open the new PR with `--base <that branch>` |
| Needs the code of two open PRs that are not in one line | Not stackable. Put the ticket back in `Todo` and take another one |
| Changes a file that an open PR of the ledger also changes, in a sequence (a migration journal, a numbered migration, a lockfile, a generated file) | Stack it on that PR, even with no code dependency. Two branches from `main` that both add to a sequence conflict at the second merge |
| Its stack would be deeper than `max-stack` | Not stackable now. Put the ticket back in `Todo` |

Write the base and the reason in the PR body: "Stacked on #101: needs the column that #101 adds.
Merge #101 first."

**Before the first stacked PR, find out what runs on a PR whose base is not the default branch.**
Read the `on.pull_request.branches` of the CI workflows, and the base-branch setting of each review
bot. If `reference.local.md` exists beside this file, it holds the answer for one repository. Often
CI and the bots run only on PRs to the default branch. Then a stacked PR gets no check and no
review, and `/mar` cannot reach green on it:

- run the checks of the repository locally on the stacked branch before you push (lint, typecheck,
  tests), and put the result in the PR body;
- mark the PR `waiting: base` and do not run `/mar` on it yet;
- when its base merges and the PR moves to the default branch, CI and the bots start: run `/mar`
  then.

### 4. Build and ship

Do `next` steps 5 and 6, from the base you chose: `git checkout -b <gitBranchName> <base>`, and
pass `--base <base branch>` to `gh pr create` when the base is not `main`. Skip `next` step 1: it
expects a merge that did not happen. Then run `/mar` on the new PR until one of its
stop conditions fires.

- **`/mar` ends green** — mark the PR `green` and go back to step 1.
- **`/mar` ends on a return time** (a reviewer quota, a late check) — mark it `waiting` with the
  time, and go back to step 1. Step 1 comes back to it after the time. If there is no other task to
  take, start a Monitor that sleeps until one minute after that time, then go back to it.
- **`/mar` ends on a decision for the user** — mark it `blocked`. Do not stack on a blocked PR.
- **A finding on a lower PR changes code that a higher PR uses** — fix it on the lower PR, then
  rebase each PR above it (below), and run its checks again.

#### After a merge, or a fix low in the stack

A squash merge gives `main` a new commit that the branches above do not have. Rebase them, do not
merge `main` into them — a merge of an old base can undo merged work with no conflict.

```bash
git rebase --onto origin/main <old-base-sha> <branch>   # after the base merged
git rebase <lower-branch> <branch>                      # after a fix on the lower branch
git push --force-with-lease origin <branch>
gh pr edit <n> --base main                              # only after the base merged
```

- Running `/autonext` allows `--force-with-lease` **only** on a branch this run created, and only
  for this rebase. Say each forced push in the report. Never force a branch you did not create, never `--force` without a lease.
- Before each push, read the PR `state`. A push to the branch of a merged PR creates the branch
  again with no error.
- If the rebase conflicts in a way that needs a decision, stop the run and report.

## When to stop

Stop the run and report when one of these is true:

- **No ticket can be taken autonomously**: each `Todo` ticket is blocked, needs a decision, needs
  the work of somebody else, or would conflict with an unmerged PR you cannot stack on.
- **The next PR cannot be stacked**: each startable ticket needs a stack deeper than `max-stack`,
  needs two stacks at once, or needs a PR that is `blocked`.
- **A person asks you to stop**, on a PR or in the conversation.
- **The same failure twice**: two tasks in a row cannot go green for the same reason (a broken
  check on `main`, a tool that does not work). That is not the work of the ticket, and a third task
  will fail the same way.
- **Verification does not go green** on a task and you cannot fix it: give the ticket back
  (`next`, "Give the claim back") and stop. Do not open a broken PR, and do not stack on it.

Before you stop, make sure that each ticket you claimed and did not ship is back in `Todo` with no
assignee.

## Report

- The ledger, as a table: ticket, PR, base, final state.
- **The merge order** of the stacks: "merge #101, then #103; #102 is independent".
- For each PR: the findings applied and skipped, grouped by reviewer; the reviewers that refused
  for quota, with the return time; the comments of people; the `/tfp` recording, or why there is
  none.
- The defaults you chose for open questions, one line each, so the user can override them.
- Why the run stopped, in one line.
- Then fire the notification:

```bash
osascript -e 'display notification "<n> PR, stop: <reason>" with title "autonext done" sound name "Glass"'
afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true
```

Match the user's language (French).

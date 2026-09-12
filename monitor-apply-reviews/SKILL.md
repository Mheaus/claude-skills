---
name: monitor-apply-reviews
description: Take a pull request all the way to green — watch for every review round as it lands, apply the coherent findings, fix failing checks, ask idle reviewers for a pass, and keep going until the checks are green and no review still asks for changes. Use when the user types /mar.
argument-hint: [pr-number]
---

`/ar` does one or two rounds and hands back. **`/mar` stays on the pull request until it is green.**

It watches for each review as it lands instead of sampling twice, fixes failing checks as well as
review findings, asks a reviewer that has gone quiet for a pass, and clears the stale
`CHANGES_REQUESTED` that otherwise blocks a merge long after every finding is addressed.

Everything `apply-reviews` says about reading, judging and replying holds here. This file adds the
loop, the reviewer handling, and the anticipation pass. Where the two disagree, this one wins.

## What "green" means

The loop ends when **all four** hold. Check all four — three of them are silent when they fail.

1. Every check on the head commit is `pass` or `skipping`.
2. No review sits in `CHANGES_REQUESTED`.
3. Every top-level review comment has a reply.
4. Nothing is left unpushed locally.

`gh pr checks` alone answers only the first. A pull request whose checks are all green and whose
review still says `CHANGES_REQUESTED` cannot be merged, and nothing in the checks says so.

## 1. Take stock before touching anything

```bash
gh pr view <n> --json number,url,state,headRefOid,mergeable,reviewDecision
gh pr checks <n>
gh api repos/<owner>/<repo>/pulls/<n>/reviews \
  --jq '.[] | select(.user.login | endswith("[bot]")) | "\(.user.login) \(.state) \(.submitted_at)"'
gh api repos/<owner>/<repo>/pulls/<n>/requested_reviewers --jq '.users[].login, .teams[].slug'
```

Write down, for the report: which reviewers exist on this repository, which have answered, which
were requested and never did. **Never filter on a list of known bot names** — match the `[bot]`
suffix, so a reviewer added after this file was written is still seen. An allowlist that silently
drops an unknown reviewer reports "no review", which is indistinguishable from a review that found
nothing.

One quirk worth carrying: a bot may use a different login on `/reviews` than on `/comments` — some
post line comments without the `[bot]` suffix. Filter both forms. Your own replies appear on both.

## 2. The round

Repeat until green, or until a stop condition in §6 fires.

### 2a. Collect everything actionable

- top-level line comments — `select(.in_reply_to_id == null)`, minus the ones already answered;
- **review bodies** — a finding often sits there rather than on a line, especially one that spans
  files or falls outside the diff;
- **failing checks** — read the failing job's log, not just its name;
- **threaded replies from a reviewer** — a bot that answers your reply may confirm, or may ask for
  one more thing. That is part of the round, not noise.

An out-of-diff finding has no thread to reply into. Answer it in a PR comment and say which finding
it answers, otherwise it reads as unaddressed.

### 2b. Judge, then apply

Read the surrounding code before accepting anything. Apply what is coherent; skip what is wrong,
out of scope, or rests on a premise the code contradicts — and **verify the premise yourself**
rather than trusting either side. A reviewer that is wrong about the cause is often right that
something is there.

When a finding claims a constraint or a behaviour, check it against the running system, not only
against the source: a schema constraint against the live database, a runtime value by executing the
path. A finding worth skipping frequently points at a real defect next to the one it names — this
is the single highest-value habit in this skill.

### 2c. Anticipate the next review — before you push

See §4. This is what turns four rounds into two.

### 2d. Verify in both directions

A fix is verified when its test **fails without it**. Run the suite against the pre-fix code and
confirm red, then restore and confirm green. A test that passes either way is worth nothing, and a
reviewer will eventually say so — after another round trip.

Restoring: keep a copy of the fixed file before reverting. `git checkout <file>` takes the whole
file back to its committed state, including changes you have not committed yet.

Read exit codes, not output patterns. `command >/dev/null 2>&1 && echo OK || echo FAIL` survives a
tool changing its wording; grepping for one phrase gives a false green the day it changes.

### 2e. Commit, push, reply

- Stage files explicitly. Repo commit style. Never `--amend`, never `--no-verify`, never force-push.
- If a pre-commit hook fails, **find out which target failed** before retrying. Retrying a hook
  blind treats a real failure as a flake, and the second failure costs more than the check would
  have.
- Reply to every comment: applied, with the commit SHA and what changed; or skipped, with the
  reason. Name the symmetric cases you checked (§4) — it is what stops the follow-up round.

### 2f. Re-arm the watch

```bash
# description: "PR <n>: round <i>, waiting for reviews and checks"
# timeout_ms: 1500000   # 25 min cap
state() {
  gh api repos/<owner>/<repo>/pulls/<n>/reviews \
    --jq '.[] | select(.user.login | endswith("[bot]")) | "review \(.user.login) \(.submitted_at)"' 2>/dev/null
  gh pr checks <n> 2>/dev/null | awk -F'\t' '$2!="pending"{print "check " $1 " " $2}'
}
seen=$(state | sort -u); quiet=0
echo "already in: $(echo "$seen" | wc -l | tr -d ' ') signals"
while [ "$quiet" -lt 600 ]; do
  sleep 30
  now=$(state | sort -u)
  if [ "$now" != "$seen" ]; then
    comm -13 <(echo "$seen") <(echo "$now")
    seen=$now; quiet=0
  else
    quiet=$((quiet + 30))
  fi
done
echo "quiet for 10 minutes"
```

Watching reviews **and** checks together is the point: a push triggers both, and a red check is as
much a reason to stay as a new comment.

## 3. Reviewers that do not answer

A round that waits forever on a reviewer with nothing to say is the main way this loop stalls.

- **Requested but silent after one quiet window** — request once more. Do not request a third time;
  say in the report that the reviewer never answered, and carry on. "Nobody else reviewed" and "I
  stopped waiting" are different facts and the report must not blur them.
- **Answered, then quiet after your push** — normal. Most reviewers re-review on a new commit;
  give it one window before nudging.
- **Never present on this repository** — do not wait at all. Name it once in the report and move on.

Asking again is host-specific. The two shapes:

```bash
# a reviewer that is a GitHub account
gh api --method POST repos/<owner>/<repo>/pulls/<n>/requested_reviewers \
  -f 'reviewers[]=<login>' 2>/dev/null || true

# a reviewer driven by a comment command — check the reviewer's own docs for the verb
gh pr comment <n> --body "@<reviewer> review"
```

**A stale `CHANGES_REQUESTED` needs one of these on purpose.** A reviewer confirming your fixes in a
thread does not lift the state of its review, and the pull request stays unmergeable with every
finding addressed. When all findings on such a review are answered, ask that reviewer for a fresh
pass, then wait for it. If it still does not lift, say so plainly — the person merging needs to know
it must be dismissed by hand.

## 4. Anticipation — the part that saves rounds

**A reviewer's finding is a sample, not the population.** Most follow-up rounds in practice are the
same defect in its other half, which was there the whole time. Before pushing, spend two minutes on
the list below, fix what it turns up in the same commit, and say in your reply that you checked it.

Ask, for every fix:

| You changed | Look at |
|---|---|
| an insert path | the update path on the same row, and the delete |
| a read guard | the write that reads the same value, and the reverse |
| a guard in a loader | the action beside it, and the endpoint behind both |
| one entry of a cache or map | every other collection that call was meant to empty |
| one branch of a conditional | the other branch, and the default |
| a function signature | every caller, the doc comment above it, and the examples in the module header |
| one column of a write | the constraints that write can now violate, and what a conflict answers |
| one member of a repeated pattern | the rest of the pattern, by grep — and say how many there are |

Two more that are not about symmetry:

- **A test you just wrote** — run it against the pre-fix code. If it stays green, it pins nothing,
  and a reviewer asking for "a regression test" is asking for one that discriminates.
- **A mock you just added** — prove it takes effect, by the same reversal. A mock pointed at a
  barrel while the code imports the module directly replaces nothing, and the suite passes for a
  reason unrelated to it.

Say the result in the reply, including the negative:

> Checked the update path and the delete alongside the insert; only the insert could reach it,
> because …

That sentence is what keeps the next round from existing. It is also honest in a way "fixed" is not:
it says what was examined, not merely what was changed.

## 5. Failing checks are part of the loop

`/ar` stops at reviews. `/mar` does not: a red check keeps the pull request from green as surely as
a finding.

Read the failing job's log before touching anything, and treat a formatter or linter failure as a
real failure — those are the ones most often dismissed as noise and most cheaply fixed. If the same
check fails twice for different reasons, that is a signal about the change, not about the check.

A check that fails for a reason outside this pull request — an expired credential, a flaky external
service, a pre-existing failure on the base branch — is not yours to fix. Verify it fails on the
base branch too, then say so and stop treating it as a blocker.

## 6. Stopping

End the loop and report when any of these fires. None of them is a failure — an unfinished loop
reported honestly is worth more than a loop that keeps going.

- **Green.** All four conditions of the header hold.
- **Three consecutive rounds each raising a genuinely new product defect.** Not a new test request,
  not a follow-up on your own fix — a new defect in the code under review. That is the change
  speaking, not a queue: stop and put it to the user.
- **A finding that needs a decision you cannot default.** Which roles may do a thing, whether a
  behaviour is wanted, what a figure should mean. Apply nothing, state the options, ask.
- **A fix that would exceed the pull request's subject.** File it, name the ticket in the reply,
  leave it.
- **Wall clock.** After roughly an hour and a half of watching, report where it stands rather than
  holding the session open.

Distinguish, in the report, a round that *completed your own previous fix* from a round that found
something new. The first is the loop working. The second, repeated, is a warning.

## 7. Report

- Every finding, grouped by reviewer: applied with its SHA, or skipped with its reason.
- How many rounds, and what ended each one.
- Which reviewers answered, which were asked twice, which never came.
- The final state of all four green conditions — and for any that is not met, what it needs from
  the user.
- Anything anticipation caught that no reviewer raised. This is the part worth reading.

## Important

- **Never merge.** Green is the goal; merging is the user's.
- Never force-push, never `--no-verify`, never `--amend` after a failed hook.
- Never apply a suggestion without reading the surrounding code.
- A recording or a measurement is evidence, not decoration: if it shows the change misbehaving, fix
  that before finishing rather than publishing it and reporting success around it.

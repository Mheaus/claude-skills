---
name: monitor-apply-reviews
description: Take a pull request all the way to green — watch every review round, every comment from a person and every check as they land, apply the coherent findings, fix failing checks, ask idle reviewers for a pass (never one out of quota, and one that announced a return time only after it), and keep going until the checks are green and no review still asks for changes. Use when the user types /mar.
argument-hint: [pr-number]
---

`/ar` does one or two rounds and hands back. **`/mar` stays on the pull request until it is green.**

It watches for each review as it lands instead of sampling twice, fixes failing checks as well as
review findings, asks a reviewer that has gone quiet for a pass, and clears the stale
`CHANGES_REQUESTED` that otherwise blocks a merge long after every finding is addressed.

Everything `apply-reviews` says about reading, judging and replying holds here. This file adds the
loop, the reviewer handling, and the anticipation pass. Where the two disagree, this one wins.

**Read [`../apply-reviews/reviewer-availability.md`](../apply-reviews/reviewer-availability.md)
first.** It gives the two scripts this loop uses, the reply marker, the quota rules and the rules for
comments from people. If `reference.local.md` exists beside this file, read it too: it holds the
facts of one repository (the real checks, the verb that restarts a reviewer, its quota).

## What "green" means

The loop ends when **all six** hold. Check all six — most of them are silent when they fail.

1. Every check on the head commit is `pass` or `skipping`. A check that fails only because a
   reviewer refused for quota does not count, but only when a review body or a status description
   proves the quota. Never exclude a check by its name.
2. No review sits in `CHANGES_REQUESTED`.
3. Every top-level review comment has a reply.
4. Every comment from a person has an answer: a reply, or a push that does what it asked.
5. Every reviewer has reviewed the current head, or is recorded as unavailable (quota with no
   return time, or a return time after the wall clock of §6).
6. Nothing is left unpushed locally.

`gh pr checks` alone answers only the first. A pull request whose checks are all green and whose
review still says `CHANGES_REQUESTED` cannot be merged, and nothing in the checks says so.

## 1. Take stock before touching anything

```bash
gh pr view <n> --json number,url,state,headRefOid,mergeable,reviewDecision
PR=<n> REPO=<owner>/<repo> ~/.claude/skills/apply-reviews/scripts/pr-signals.sh
gh api repos/<owner>/<repo>/pulls/<n>/requested_reviewers --jq '.users[].login, .teams[].slug'
```

The script paginates every endpoint: `/reviews` returns 30 rows a page, and a long loop passes that
in a day. It prints the commit each review is on: a review on an older head is answered by the push,
one on the current head is the round. It also prints the quota notices, the comments of people and
the checks of the head.

Write down each reviewer's **availability**: reviewed, waiting, refused with a return time (note the
`until=`), or refused with no return time. The rest of the loop depends on this list.

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
  files or falls outside the diff. Copilot goes further: a review titled « Needs a closer look »
  with « Comments generated: 0 » can carry a **« Suppressed comments »** / « Previously missed »
  section in its body — real findings with file and line, posted as no thread at all. A thread scan
  reports « nothing open » while three defects sit there. Read the body of every review on the
  current head, approvals included, before calling a round quiet;
- **failing checks** — read the failing job's log, not just its name;
- **threaded replies from a reviewer** — a bot that answers your reply may confirm, or may ask for
  one more thing. That is part of the round, not noise.
- **comments from people** — the lines tagged `human`, in a thread or in the conversation. They come
  first in the round. A question gets an answer, a request is a finding, an instruction ("stop",
  "do not merge") applies at once, and a decision goes to the user (§6).

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

Two shapes that cost a round each when missed:

- **A guard that restates a domain notion** (« a real sale », « the level a row leaves », « a
  stated level ») — grep how the repository already states it (`REAL_SALE`, `SALE_ELIGIBLE`,
  `SLOT_LEVEL_X`…) and reuse that constant, or copy it verbatim and say so. Re-deriving it by hand
  is how a pickup, a refund or a null product each became their own round.
- **A guard added in one query** — a page usually reads the same predicate on three surfaces: the
  row badge, the row preview and the write (and the bulk preview). A guard that lives in the write
  alone leaves the row offering a button that fails, and the row unreachable by any correction.
  Put it in the shared predicate, or make the write degrade (take no leg) rather than refuse.

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
- End every body you post with `<!-- claude-reply -->`. You post with the user's login; the marker
  is what keeps the watch from reading your reply as a comment of the user.
- When a reviewer is short of quota, put the fixes of one round into one push. Each push can use one
  review of its quota.

### 2f. Re-arm the watch

```bash
# description: "PR <n>: round <i>, waiting for reviews, comments and checks"
# timeout_ms: 1500000   # 25 min cap
EXPECT='<a real CI check>' PR=<n> REPO=<owner>/<repo> ~/.claude/skills/apply-reviews/scripts/pr-watch.sh
```

The watch prints each new signal: a review, a line comment or a reply, a conversation comment (a
person's or a bot's, an edit included), a quota notice, a check that changes state. Watching all of
them together is the point: a push triggers reviews and checks, a person can write at any time, and
a red check is as much a reason to stay as a new comment.

The quiet time counts only when the head has checks and none is pending. CI can register its checks
many minutes after a push. A watch that counts during that gap stops before the checks exist, and
the loop then reads "quiet" as "green". A reviewer status can arrive in seconds and look like a
settled check alone: pass `EXPECT` (a regex of the CI check names, from `reference.local.md` or from
the checks of the last PR on the base branch) so the quiet time waits for real CI.

The watch stops on quiet, maybe before a far `until=`. If a reviewer still owes a review at that
time, start a Monitor that sleeps until one minute after `until=`, then read the head again and ask
once if nothing arrived.

A reviewer that returns from a quota does not always come back by itself. When the clock passes its
`until=` plus one minute and the watch shows no review of the head from it, ask it once (§3).

Monitors die with the session. After a resume, take stock again (§1) before trusting anything,
and re-arm the watch; stop the watch of the previous head when you push a new one, or two
monitors report the same check twice. Resolve threads with a GraphQL variable
(`-f query='mutation($id: ID!) {…}' -f id=<thread>`): interpolating the id into the query string
breaks on the shell's quoting and reports « malformed ».

## 3. Reviewers that do not answer

A round that waits forever on a reviewer with nothing to say is the main way this loop stalls.

- **Refused for quota** — this is not silence, and the two bullets below do not apply to it.
  Follow the quota rules further down: no request without a return time, one request at least one
  minute after it otherwise.
- **Requested but silent after one quiet window** — request once more. Do not request a third time;
  say in the report that the reviewer never answered, and carry on. "Nobody else reviewed" and "I
  stopped waiting" are different facts and the report must not blur them.
- **Answered, then quiet after your push** — normal. Most reviewers re-review on a new commit;
  give it one window before nudging.
- **Never present on this repository** — do not wait at all. Name it once in the report and move on.
- **Repeating the same minor note** (a confirmation wording, a message) on every pass, after an
  answer — answer once with the reason, do not reword the copy a fourth time, and say in the report
  that it was left on purpose. A reviewer's repetition is not a new finding.

Asking again is host-specific. The two shapes:

```bash
# a reviewer that is a GitHub account
gh api --method POST repos/<owner>/<repo>/pulls/<n>/requested_reviewers \
  -f 'reviewers[]=<login>' 2>/dev/null || true

# a reviewer driven by a comment command — check the reviewer's own docs for the verb
gh pr comment <n> --body "@<reviewer> review"
```

**Before you ask, apply the quota rules** of
[`reviewer-availability.md`](../apply-reviews/reviewer-availability.md):

- A reviewer that refused with **no return time** is not asked again in this run. A second request
  returns the same refusal and uses nothing useful. Record it as unavailable and go on.
- A reviewer that refused with a **return time** is asked **at least one minute after** that time,
  once, and only if no review of the current head arrived by itself. Some bots write that time in
  their first conversation comment and edit it in place: read the latest `updated_at` of that
  comment, not the first one.
- A new notice after your request gives a new time. Wait for it. Do not ask in a loop.
- **A mention can start a coding agent.** A mention of `@copilot` in a comment starts Copilot's
  coding agent, which pushes commits. Request that reviewer through `requested_reviewers` only.

The verb that restarts a comment-driven reviewer, and whether it reviews each push by itself, are
facts of one repository. Read them in `reference.local.md` if it exists. Otherwise take the verb
from the reviewer's documentation, and check the head for a review before you use it.

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

- **Green.** All six conditions of the header hold.
- **Three consecutive rounds each raising a genuinely new product defect.** Not a new test request,
  not a follow-up on your own fix — a new defect in the code under review. That is the change
  speaking, not a queue: stop and put it to the user.
- **A finding that needs a decision you cannot default.** Which roles may do a thing, whether a
  behaviour is wanted, what a figure should mean. Apply nothing, state the options, ask.
- **A fix that would exceed the pull request's subject.** File it, name the ticket in the reply,
  leave it.
- **Wall clock.** After roughly an hour and a half of watching, report where it stands rather than
  holding the session open.
- **No reviewer can review.** Every reviewer refused for quota, and no return time falls inside the
  wall clock. Report the return times, and do not call the PR reviewed.
- **A person asks for something you cannot default.** Stop and put it to the user.

Distinguish, in the report, a round that *completed your own previous fix* from a round that found
something new. The first is the loop working. The second, repeated, is a warning — and when the
new defects all sit in one guard you keep patching (a « no sale in between » test that learns the
shapes of a sale one round at a time), stop patching and reuse the repository's own predicate (§2b).

## 6b. Look at the UI — mandatory after a significant UI change

If a round changed what a person sees or does (a component, a layout, a copy that changes the
meaning, a new state, a form, a modal, a navigation), run **`/tfp`** before you call the PR green.
Use `/tf` if the Playwright harness cannot reach the page. Post the recording to the PR. Record the
round's change and the state the finding was about, through the real UI. A green check does not
replace it.

If the rounds touched no UI, or only code with no visible effect, say so in the report with the
reason.

## 7. Report

- Every finding, grouped by reviewer: applied with its SHA, or skipped with its reason.
- Every comment from a person, and what you did with it.
- How many rounds, and what ended each one.
- Which reviewers answered, which were asked twice, which never came, and which refused for quota
  (with the return time, or "no return time"). A refusal is never "no findings".
- The recording of §6b, or why there is none.
- The final state of all six green conditions — and for any that is not met, what it needs from
  the user.
- Anything anticipation caught that no reviewer raised. This is the part worth reading.

## Important

- **Never merge.** Green is the goal; merging is the user's.
- Never force-push, never `--no-verify`, never `--amend` after a failed hook.
- Never apply a suggestion without reading the surrounding code.
- A recording or a measurement is evidence, not decoration: if it shows the change misbehaving, fix
  that before finishing rather than publishing it and reporting success around it.

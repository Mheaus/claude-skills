# Reviewer availability and PR signals

`apply-reviews`, `monitor-apply-reviews` and `autopr` all follow this file. It covers two things:
a reviewer that cannot review, and the signals a watch must see.

## Read the signals with the script

```bash
PR=<n> REPO=<owner/repo> ~/.claude/skills/apply-reviews/scripts/pr-signals.sh
```

It prints one line per signal: reviews on every head, line comments (replies included),
conversation comments, quota notices, and the checks and commit statuses of the head commit. Two
calls with nothing new give the same output, so a watch diffs two snapshots. Use it in place of
hand-written `jq` filters. Those filters used to watch the bots only, and they missed the user's
comments.

**Mark everything you post.** End each reply, PR comment, review body or `/tfp` recording comment
with `<!-- claude-reply -->`. You post with the user's GitHub login, so the login alone cannot separate
your replies from the user's comments. The script skips marked bodies. A marker survives a session
resume and a second machine; a list of posted IDs does not.

A PR opened before this rule has unmarked comments of the agent: replies, test recordings. Before
you treat a `human` line with the user's login as a request, read its body. A reply with a commit
SHA or a « Test recording » is the agent's own.

## A reviewer that cannot review

A review bot has a quota. When the quota is used, the bot still posts something, and that post looks
like a review with no findings. **A refusal is not a review.** If you conclude "nothing found" on a
refusal, the PR looks reviewed but nobody read it.

### Detect the refusal in three places

The script tags each of these `quota`:

- **A review body.** For example, a `COMMENTED` review that says the requester "reached their quota
  limit". It has no line comment.
- **The bot's first conversation comment on the PR.** Some bots post one summary comment and then
  edit it in place, with the review in progress or the time of the next possible review. Its
  `updated_at` changes and its `id` stays the same. The script prints `until=<iso>` when the notice
  gives a delay. It counts that delay from the edit time, not from now.
- **A check or a commit status.** A quota refusal can turn a check **red**, for example
  `copilot-pull-request-reviewer` → `failure`. It can also stay **green** with a status such as
  "Review rate limited". A red check tells you nothing about the code, and a green one does not
  prove that a review happened. A commit status carries a description, and the script reads it. A
  check run carries none: the script tags it only if its name is the login of a reviewer that
  refused for quota on the same head. For any other red reviewer check, find the refusal of that
  reviewer on the same head before you call it a quota.

The script matches generic words (`quota`, `rate limit`, `limit reached`, `unable to review`,
`usage limit`) and no bot names. A new reviewer with a quota is covered without an edit. Always read
the body before you decide, not only the `state`.

### Then act on what the notice says

| The notice | What to do |
|---|---|
| **No return time** (a quota on the account) | Record the reviewer as *unavailable* for the rest of the run. Do **not** ask it again: no `requested_reviewers` call, no mention, no wait. A second request uses nothing and returns nothing. |
| **A return time** (`until=` in the script, or a time in the text) | Ask nothing before that time. **At least one minute after it**, if no review on the current head arrived by itself, ask **once**. |
| **A new notice after your request** | Read the new time and apply the same row again. Do not ask in a loop. |
| **A return time after the end of your wall clock** | Do not hold the session open for it. Report the time, and say which reviewer the PR still waits for. |

Some bots review each push by themselves when they have quota. Before you ask, look for a review on
the current head (`review … <head8>`). A review that arrived by itself makes the request useless,
and a request uses one unit of the quota. For the same reason, collect several fixes into one push
when a reviewer is short of quota.

### What a refusal changes downstream

- **A first-review wait must not stop on a refusal.** A `review … quota` line is not a review. Keep
  the wait open for the other reviewers, or stop and report that nobody could review.
- **A check that fails because of a quota is not a failure of the PR.** Exclude it from "every check
  is green" only when a review body or a status description proves the quota. Never exclude a check
  by its name.
- **The report names it.** Write "not reviewed (quota, back at 16:26)" or "not reviewed (quota, no
  return time)". Never write "no findings" for a refusal.

## How to ask a reviewer again

- A reviewer that is a GitHub account: `gh api --method POST …/pulls/<n>/requested_reviewers
  -f 'reviewers[]=<login>'`.
- A reviewer that a comment command starts: use the verb from its own documentation, and include
  the marker. If the repository has a local reference, the verb that works is written there.
- **A mention of a coding agent can start that agent.** For example, a mention of `@copilot` in a PR
  comment starts Copilot's coding agent, which then pushes commits to the branch. Request that kind
  of reviewer with the API only.

## Comments from people

The watch also shows the comments of people: the user, a colleague, a reviewer who is not a bot.
The script tags them `human`. **A comment from a person comes before the bot findings:**

- A question: answer it in the same thread.
- A request for a change: treat it as a finding. Apply it or explain why not.
- A decision the user must make (scope, behaviour, what a figure means): stop and ask the user.
  Do not choose a default in place of the user.
- An instruction such as "stop", "wait", "do not merge" or "leave this": follow it before anything
  else.

A human comment that has no reply, or no push after it that answers it, keeps the PR from green.

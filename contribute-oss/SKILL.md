---
name: contribute-oss
description: Take a defect found in an open-source dependency all the way upstream — search what is already known, follow the project's contribution rules, build a minimal public reproduction with measured numbers, find the root cause, write a fix with a test that fails without it, get an independent review, open a cordial issue and a linked PR, answer the maintainers, and protect your own apps with a patch identical to the upstream fix until a release ships. Use when the user wants to report or fix a bug in a library they do not maintain.
argument-hint: [library or upstream repo] [short description of the defect]
---

A contribution is accepted when a maintainer can check every claim in five minutes. Each step below
exists to make one claim checkable: a reproduction they can run, numbers they can repeat, a test
that fails on their `main`, a fix that changes nothing else.

**Read `reference.local.md` beside this file first, if it exists.** It holds the facts of one
machine: which GitHub account to use, how to push to a fork, which runtimes are installed, and the
rules of the user about commit trailers. If it is absent, ask the user which account owns the fork
and whether commits carry any attribution trailer.

## 1. Search before you write anything

Search the upstream tracker for the symptom, the error text and the function name, in **open and
closed** issues and pull requests. Also read the changelog of every release after the version in
use, and the `main` branch of the file at fault.

- A closed issue with the same symptom often means a partial fix. The new report is then a
  follow-up: cite the issue and the fix PR, and say which window the fix does not cover.
- Decide the disclosure channel only after this search. A crash that an anonymous client can
  trigger is a denial of service. If nothing about it is public, follow `SECURITY.md` and do not
  open a public issue. If the project already discusses it in public, a private advisory adds
  nothing: go public.
- Never state in public that something was "reported privately" unless it was.

## 2. Read the contribution rules

Read, in the upstream repo: `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`,
`.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`, and the last ten merged PRs. Write
down:

- the base branch, the commit style, and the PR title style;
- what a reproduction must be (a failing integration test in their repo, a StackBlitz, a repo);
- whether a PR needs a **change file** (`.changeset/`, `packages/*/.changes/<bump>.<name>.md`, a
  `CHANGELOG` entry) and its exact format — copy a neighbour;
- the checks they run: tests, lint, format, typecheck, and the runtime versions of their CI;
- the "related package" or "validations" fields of the issue template. Fill every field.

## 3. Build a minimal reproduction

Start from the project's own starter or template, and add only what the defect needs. Pin every
version. Keep it in its own public repo, with a README that states the versions, the commands and
the results table.

- **Where the code comes from matters.** A compiled file in `node_modules` and the same code in
  the project's source do not go through the same transforms. If the defect needs a compiled
  package, make a local package with a `dist/` that looks like the real one.
- **Measure, do not anecdote.** Write a script that runs N trials and prints one line per trial.
  Run it on each runtime version that the project supports. Report every value, not a mean.
- **Make the script prove that it measured something.** It must check that the server started,
  and that the failure signature (the exact error text) is in the log. "No answer" alone is not a
  crash: a wrong binary path also gives no answer.
- **Tune the parameters to the window.** If the defect needs an abort during a response, the abort
  must come before the response ends. A response of 5 ms with aborts at 10–50 ms tests nothing. A
  negative result with the wrong parameters is not evidence. Say which parameters hit the window.
- Copy the error and the stack trace **from the log**. Never type them from memory.

Remove from the public repo what was only for you: drafts, logs, private advisory text.

## 4. Find the root cause

Add temporary logging to the built file that the reproduction runs, in every build variant that the
package ships (`development` and `production`, `esm` and `cjs`). Record the state at the failure
over several trials. The cause is confirmed when the state is the same each time and explains the
symptom.

When the cause is a platform behaviour (a web standard, the runtime), link to the exact algorithm in
the specification. Then write the smallest script that triggers the defect deterministically,
without a server. That script becomes the unit test.

Restore every file in `node_modules` that you changed, and check it with a `grep` for your marker.

## 5. Write the fix and the test

- Change as little as possible. Reuse the names and the style of the file.
- **The test must fail without the fix.** Put the file from the base branch in place
  (`git show origin/main:<path> > <path>`), run the test, confirm the failure and its message,
  then restore your version. Do this for every test you add, and again after each change.
- **The test must prove its own path.** If the defect lives in a narrow window, assert that the
  test reached that window. Then remove the precondition (for example the pending read) and check
  that the assertion fails. A test that passes through the regular path proves nothing.
- Before you add a test helper, search the test folders for one that does the same. If none fits,
  know why: for example, the existing helpers wait with a timer, and the test must not let that
  timer fire.
- Run the project's own lint, format, typecheck and the test folder of the module. Add the change
  file.
- Run the reproduction against the built fix (copy the build output into its `node_modules`) and
  put those numbers next to the baseline.

## 6. Get an independent review before you publish

Spawn an agent that has not seen your reasoning. Give it the branch, the files, the issue text and
the test command, not your conclusions. Ask it to check the specification semantics, the paths
that can still fail (unhandled rejection, a promise that never settles, a resource that is never
released, wrong output for a normal request), and whether the tests discriminate. Tell it to
restore the tree and to post nothing.

Verify each finding yourself. Write a finding as a failing test before you fix it. A finding that
the code contradicts gets a reply with the evidence, not a change.

Then run the comment pass (`simplify-comments`, or `/sc`). Fix any comment that claims more than the
code does: an overstated comment is a defect in a PR.

## 7. Publish: issue first, then the PR

1. Fork, push the branch, and check that no attribution trailer the user forbids is in the commits.
2. Open the issue with the template. Order of the body:
   - thanks, and one sentence on what you build with the project;
   - the symptom, with the error copied from the log;
   - the reproduction link, the commands and the results table (baseline and fix);
   - what happens, step by step, with the link to the specification;
   - "I have opened #N with a fix. I am happy to change the approach if you prefer another one."
3. Open the PR against the base branch. Start the body with `Fixes #<issue>`. List each change in
   one line, the tests (with "fails on `main` with …"), the checks you ran, and the numbers.

Be cordial and exact. Write no claim that the reader cannot check. A first-time contributor's CI
waits for a maintainer to approve the workflows: say so to the user, do not wait on it.

## 8. Answer the review

- Check who the reviewer is (`author_association`). Call someone a maintainer only when that field
  says `MEMBER`, `OWNER` or `COLLABORATOR`.
- Reproduce the reviewer's scenario as a test, see it fail, fix, see it pass, push.
- Reply with the commit SHA, what changed, and the related paths you checked. Name a limit that
  stays, with the reason.
- If an earlier statement of yours was wrong, correct it in the thread.

## 9. Protect your own apps until a release ships

- Patch the dependency with the **exact build output** of the upstream fix (`pnpm patch`, then copy
  the built files, then `pnpm patch-commit`). Change only the files that the fix changes. Do not
  write a "similar" fix by hand: it drifts, and it cannot be removed with confidence.
- Patch only the apps that run the code at fault. An app on another mode or version does not need
  it.
- Measure in the real app: baseline without the patch, then with it, same parameters. Add a run
  under concurrency, the dev server, and a memory comparison with normal traffic.
- If the app is a library, the patch does not ship to its users. Document in its README what they
  must apply, with the link to the upstream issue.
- **Keep the patch identical to the upstream PR.** Each upstream change after a review means a new
  patch in every app.
- **Before you push to a PR branch, check that the PR is still open** (`gh pr view <n> --json
  state`). A push to a merged branch is lost. If the PR is merged, open a follow-up PR from the
  base branch with the missing commits.
- Write in each patch PR when to remove it: when a release contains the fix.

## 10. Report

- The links: reproduction repo, issue, PR, and each downstream PR.
- The numbers: baseline and fix, with trials, runtimes and parameters.
- Which tests fail on the base branch, and how that was checked.
- The findings of the independent review: applied with their commit, or answered with the evidence.
- What waits on someone else: workflow approval, a maintainer review, a merge, a release.
- Every mistake you made in public, and where you corrected it.

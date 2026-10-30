---
name: test-feature
description: Test the current change end-to-end through its real interface — a web page, a CLI, an API, an app — with the dev environment started and stopped for you, evidence recorded, and the recording posted to the PR or Linear. Use for /tf and /tfp, or when asked to try, demo or validate a feature for real.
argument-hint: "[url | command] [headed] [chrome]"
---

Test the change the way a person would meet it, keep the proof, and leave the machine as it was.
A green test suite says the code does what the tests say. This says what the change does.

Files of this skill:

- `scripts/devenv.sh` — starts, checks and stops the dev environment (`up` / `status` / `down`).
- `scripts/publish.sh` — puts the evidence on MinIO and links it from the PR, or prints a URL.
- `drivers.md` — how to drive each kind of surface, and which evidence it gives.
- `lib/harness.mjs` — the Playwright harness of the web driver.
- `chrome.md` — the Claude in Chrome driver and its traps (`/tf`, or `chrome` in the arguments).

## 1. Know what changed

Read `git log --oneline -5`, `git diff <base>...HEAD --stat` and the diff of the source files.
Write down, in one line each:

- the **surface**: a page, a CLI command, an HTTP route, a TUI, a mobile or desktop app, a library API;
- the **main action** and its expected result;
- **one awkward case**: empty, error, refusal, slow, narrow screen, second run.

If the change has no surface a person meets, say so in the report and stop: the tests cover it.

## 2. Start the environment

Find how the project runs, in this order: the repo's `CLAUDE.md` (it often pins ports for agents),
`README`, `package.json` scripts, `Makefile`, `Procfile`, `docker-compose.yml`. Find what proves it
is ready: a URL, a port, a line in the log, a file.

```bash
DEV=~/.claude/skills/test-feature/scripts/devenv.sh
$DEV up --name <repo>-<branch> --cwd <checkout> --cmd "<start command>" \
  --ready http://localhost:<port>/ [--ready tcp:<port>] [--ready 'log:<regex>'] [--timeout 180]
```

- It **reuses** an environment that already answers from the same checkout, and never stops it.
- It **refuses** a port held by another checkout. A worktree is another checkout: stop the other
  server, or start this one on free ports if the project allows it.
- It returns at once. The log is in the path it prints. On a failure it prints the log tail.
- No long-running command needs `run_in_background`: `up` detaches it.

A database, a queue or a container that the project starts by itself is part of `--cmd`. One
that it expects to be there (`docker compose up -d db`) is a second `up` with its own name.

## 3. Drive the real interface

Pick the driver in `drivers.md`. The default for a page is Playwright (`lib/harness.mjs`);
`/tf` or `chrome` in the arguments asks for Claude in Chrome (`chrome.md`).

- Act as a person: a click on the button, a command typed in the terminal, a request on the route.
  A call to the function behind it validates the harness, not the feature.
- Do the main action, then the awkward case.
- **Measure, then claim.** Next to each capture, read a value that proves the claim: a computed
  style, a status code, an exit code, a line of output, a row in the database. A capture shows;
  a value proves.
- Look at each screenshot or transcript yourself before you go on. Fix the runner and run again;
  it is cheap.

## 4. Publish the evidence

```bash
~/.claude/skills/test-feature/scripts/publish.sh <file> --title "<feature>" --note "<what it proves>"
```

It takes the PR of the current branch and prints `HOST`, `URL` and `COMMENT`.

- The file goes **to MinIO**, and the comment links to it. The comment keeps the author that gh
  uses, the App of the agent for example.
- `--github` uploads an image or a video up to 10 MB to GitHub (`gh pr comment --attach`, gh 2.99
  or later). The upload endpoint refuses an App installation token, so the script posts it with
  the user's own login: the comment has the user as its author. Use it only if the user asks.
- With no PR, it uploads to MinIO and prints the URL: post it on the Linear issue (`save_comment`).

Never publish a secret, a token or personal data. A screenshot or a log can show them.

## 5. Stop the environment

```bash
$DEV down --name <repo>-<branch>
```

It stops every process it started, children in other process groups and daemons included, and
lists the files that changed in the checkout while it ran. A lockfile or a generated file that
the run rewrote: `down --restore` puts back the tracked ones. A file you changed on purpose: keep
it. `$DEV status` lists what is still up. Stop it even when the test failed.

## 6. Report

```
## Test — <feature>
Surface: <url, command or route> · Evidence: <comment or Linear link>
Passed: <each check, with the value that proves it>
Issues: <steps to reproduce, the error, the log line>
Not tested: <what you could not reach, and why>
Environment: <started and stopped | reused, left running> · Files the run changed: <none | list>
```

## Rules

- This skill changes no source file, and commits nothing. Its writes: the environment state under
  `$TMPDIR/claude-devenv`, the scratchpad, the bucket, the PR or Linear comment.
- Stop only what `devenv.sh` started. A server of the user, in another terminal, stays up.
- If a step fails twice in the same way, stop and say what you saw. Do not loop.
- If the recording shows the feature misbehaving, the report says so. Do not publish it as a pass.

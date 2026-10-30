# Drivers

One driver per kind of surface. Each gives a piece of evidence that `scripts/publish.sh` accepts.
Keep the runner and its output in the scratchpad, never in the repo.

| Surface | Driver | Evidence |
| --- | --- | --- |
| Web page | Playwright, through `lib/harness.mjs` | `.webm` (≤ 5 MB), else `.gif`; `.png` per state |
| Web page, when Playwright cannot reach it | Claude in Chrome (`chrome.md`) | `.gif` |
| CLI | the shell, recorded by `script` | `.txt` transcript |
| TUI | `asciinema rec`, or `script` | `.cast` or `.txt` |
| HTTP API | `curl -i`, one call per step | `.txt` transcript |
| iOS / Android app | `xcrun simctl io booted recordVideo` / `adb shell screenrecord` | `.mp4` / `.mov` |
| Desktop app | `screencapture -v` (macOS) | `.mov` |
| Library | a short consumer script that imports the built package | `.txt` transcript |

## Web: Playwright

Write `run.mjs` in the scratchpad and run it **from the project directory**: the harness takes
Playwright from the project first.

```js
const { openSession, devLogin, pickVideoArtifact, report } = await import(process.env.TFP_HARNESS);
const BASE = process.env.TFP_BASE;
const OUT = process.env.OUT;

const s = await openSession({ outDir: OUT, viewport: { width: 1440, height: 900 } });
let result;
try {
  // Only if the page needs a session: see "Dev login" below.
  // await devLogin(s.page);
  await s.page.goto(`${BASE}/<route>`, { waitUntil: 'domcontentloaded' });
  await s.page.getByRole('heading', { name: /<on the page>/i }).waitFor({ timeout: 20000 });
  await s.page.screenshot({ path: `${OUT}/01-before.png` });

  await s.page.getByRole('button', { name: /<main action>/i }).click();
  await s.page.getByText(/<expected result>/i).waitFor({ timeout: 10000 });
  await s.page.waitForTimeout(600); // the last frame shows the settled state
  await s.page.screenshot({ path: `${OUT}/02-after.png` });

  // Booleans and values, no throw: a failed check still reports what it saw.
  result = {
    done: (await s.page.getByText(/<expected result>/i).count()) > 0,
    consoleErrors: s.consoleErrors,
    pageErrors: s.pageErrors,
    httpErrors: s.httpErrors,
  };
} finally {
  await s.close(); // finalizes the video: pick the artifact after it, never inside the try
}
report({ ok: result.done, artifact: pickVideoArtifact(OUT, { gifName: 'test_<feature>.gif' }), ...result });
```

```bash
OUT=<scratchpad>/tf-out; mkdir -p "$OUT"
cd <checkout> && TFP_HARNESS=~/.claude/skills/test-feature/lib/harness.mjs \
  TFP_BASE=http://localhost:<port> OUT="$OUT" node <scratchpad>/run.mjs
```

Read the `TFP_REPORT` line and each `.png` with the Read tool. `headed` in the arguments:
`TFP_HEADLESS=false`. No Chromium downloaded: `TFP_CHANNEL=chrome` uses the installed Chrome.

**Dev login**, only when the page needs a session. Find the dev route of the app
(`grep -rn "dev-login\|dev/login" src app`), then set:

| Route shape | Variables |
| --- | --- |
| `GET` that sets the cookie | `TFP_LOGIN_PATH=/api/dev/login` |
| `POST` that takes an email | `TFP_LOGIN_PATH=/api/auth/dev-login TFP_LOGIN_METHOD=POST TFP_LOGIN_EMAIL=<dev user>` |

`setActiveOrg(id)` writes the active organization of the dev session into the local Postgres
(`TFP_PG_CONTAINER`, `TFP_PG_DB`). Use it only when the feature needs another organization.

Traps:

- `waitUntil: 'networkidle'` never fires on a dev server with hot reload: the socket stays open.
- A document served by `page.route(...).fulfill` loses its address space. Chromium's Local Network
  Access then refuses its calls to a server on the loopback. To add a header to a page, wait for
  what the page draws, not for what it fetches.
- Selectors: `getByRole`, `getByLabel`, `getByText` first. They cross open Shadow roots.

## CLI and TUI

```bash
script -q <scratchpad>/cli.txt <command> <args>   # macOS: script -q FILE CMD
echo "exit=$?" >> <scratchpad>/cli.txt
```

Run the main case and the awkward one, each with its exit code. For a TUI, `asciinema rec
--command "<command>" <scratchpad>/tui.cast` when asciinema is installed. Strip colour codes
before you read a transcript: `sed 's/\x1b\[[0-9;]*m//g'`.

## HTTP API

```bash
{ echo '$ curl -i -X POST <url> -d <body>'; curl -sS -i -X POST <url> -H 'content-type: application/json' -d '<body>'; } \
  >> <scratchpad>/api.txt 2>&1
```

One block per step, with the status line and the body. Remove a token or a cookie from the
transcript before you publish it.

## Mobile and desktop

Start the simulator or the emulator with `devenv.sh up` if it is part of the dev command, else
check that it runs. Record while you drive the app, stop the recording with Ctrl-C (`simctl`) or
`adb pull` the file, then publish it. Without a way to drive the app, say what you checked by hand.

---
name: test-feature-pw
description: Test the current feature end-to-end with a Playwright script (no Chrome extension / no permission gate), record a GIF, and attach it to the PR. A gate-free sibling of test-feature.
---

Test the current feature end-to-end by **driving Playwright's own Chromium from a Node script** — no Chrome extension, so none of the `test-feature` permission-gate friction (recurring "Permission denied by user", and the 500px `resize_window` viewport pinning). Playwright gives exact viewport control, console/network capture, and native video recording.

This is a **sibling** of `test-feature`, not a replacement. Prefer it whenever the extension gate has been fighting you, or when you want a rerunnable artifact (the generated script can seed a project's E2E suite). Prefer plain `test-feature` for quick interactive exploration where you don't know the DOM yet.

Nothing here is tied to one repo. Everything project-shaped — origin, dev-login route, Postgres container — is passed in as an environment variable, and the harness throws a named error rather than falling back to another project's value.

The reusable harness lives at `~/.claude/skills/test-feature-pw/lib/harness.mjs` and carries all the boilerplate (launch, dev login, active-org, console/network capture, webm→gif). Your per-feature runner only expresses the interactions + assertions.

## Arguments

- An explicit **URL** → use it as the base (skip detection).
- The word **`headed`** anywhere in the args → run with a visible browser window (`TFP_HEADLESS=false`). Default is headless.

## Steps

### 1. Understand what was built

Run in parallel (same as `test-feature`):
- `git diff HEAD~1 --stat`
- `git log --oneline -5`
- `git diff HEAD~1 -- '*.tsx' '*.ts' '*.jsx' '*.js'` (skip lockfiles/generated)

Identify the route, the UI added/changed, the main action, and one edge case. Note stable selectors you can target: prefer `getByRole(..., { name })`, `getByText`, `getByLabel` over CSS.

### 2. Find the dev server URL and the project's dev-login route

If a URL was passed, use it. Otherwise look for the port the repo pins for Claude Code sessions — most repos state it in `CLAUDE.md` — then confirm something is listening:
```bash
grep -riE 'claude code|dev server' CLAUDE.md | grep -oE ':[0-9]{4}' | sort -u   # the repo's own convention
lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | grep -E ':(3000|4000|4200|517[0-9]|52[0-9]{2}|8000|8080)\s'
```
If it isn't running, tell the user and stop — do **not** start it yourself.

Then find **how this app logs in during dev**, because it differs per project and the harness needs it spelled out. Look at the login route for a dev shortcut:
```bash
grep -rn "dev-login\|dev/login\|DEV_LOGIN" src app --include=*.ts --include=*.tsx | head
```
The two shapes seen so far:

| Shape | Env |
| --- | --- |
| `GET /api/dev/login` sets the cookie itself | `TFP_LOGIN_PATH=/api/dev/login` |
| `POST /api/auth/dev-login` with `{ email }` | `TFP_LOGIN_PATH=/api/auth/dev-login TFP_LOGIN_METHOD=POST TFP_LOGIN_EMAIL=admin@example.dev` |

Only if the feature needs a specific **active organization**, also note the local Postgres container and database (`docker compose ps`) — `setActiveOrg` writes the session row directly and requires `TFP_PG_CONTAINER` + `TFP_PG_DB`. Skip it when the dev user's existing org is fine.

### 3. Write the per-feature runner

Write `run.mjs` into the scratchpad dir. It imports the harness via `process.env.TFP_HARNESS` (a dynamic import, so no hard-coded path), logs in, sets the org, drives the feature, screenshots at key moments, and prints a `TFP_REPORT` JSON line. Template:

```js
// run.mjs — adapt the route, selectors and assertions to the feature under test.
const { openSession, devLogin, setActiveOrg, pickVideoArtifact, report } = await import(process.env.TFP_HARNESS);
const BASE = process.env.TFP_BASE; // required — no project default
const OUT = process.env.OUT;
const ORG = process.env.TFP_ORG; // only when the feature needs a specific org

const s = await openSession({ outDir: OUT, viewport: { width: 1440, height: 900 } });
let result;
try {
  await devLogin(s.page); // route comes from TFP_LOGIN_* — see step 2
  if (ORG) setActiveOrg(ORG);

  // ── Happy path ──────────────────────────────────────────────────────────
  // Not `networkidle` if the dev server keeps a socket open (Vite's HMR does):
  // it never fires and the goto times out at 30s.
  await s.page.goto(`${BASE}/<route>`, { waitUntil: 'domcontentloaded' });
  await s.page.getByRole('heading', { name: /<something on the page>/i }).waitFor({ timeout: 20000 });
  await s.page.screenshot({ path: `${OUT}/01-before.png` });

  await s.page.getByRole('button', { name: /<the main action>/i }).click();
  await s.page.getByText(/<the expected confirmation>/i).waitFor({ timeout: 10000 });
  await s.page.waitForTimeout(600); // let toasts/animations settle for the recording
  await s.page.screenshot({ path: `${OUT}/02-after.png` });

  // ── Collect results (don't throw here — a throw would skip the report;
  //    prefer booleans so a failed check still reports what it saw) ─────────
  result = {
    confirmed: (await s.page.getByText(/<the expected confirmation>/i).count()) > 0,
    consoleErrors: s.consoleErrors,
    apiErrors: s.apiResponses.filter((r) => r.status >= 400),
  };
} finally {
  await s.close(); // MUST run before reading the video — close() finalizes the webm
}
// Choose the artifact AFTER close(): the webm is only complete once the context
// is closed (reading it inside the try fails). pickVideoArtifact keeps the raw
// webm when it's ≤5 MB (higher quality, usually smaller) and only falls back to
// a compressed GIF for heavier recordings.
const artifact = pickVideoArtifact(OUT, { gifName: 'test_<feature>.gif' });
report({ ok: result.confirmed && result.apiErrors.length === 0, artifact, ...result });
```

Notes:
- **Screenshots** are your eyes — save PNGs at each meaningful state and `Read` them; iterate on the script and rerun (cheap, deterministic).
- **Order matters**: `openSession` records a webm; it is only finalized by `close()`. Always `toGif` **after** the `finally`, never inside the `try`.
- Prefer `waitFor()` on an expected element over fixed sleeps; add one small `waitForTimeout` only so the GIF's last frame shows the settled state.
- Keep the run short and focused; capture one edge case too (empty state, disabled control, validation error).

### 4. Run it & inspect

```bash
SCRATCH="<your scratchpad dir>"
OUT="$SCRATCH/tfp-out"; rm -rf "$OUT"; mkdir -p "$OUT"
TFP_HARNESS="$HOME/.claude/skills/test-feature-pw/lib/harness.mjs" \
TFP_BASE="http://localhost:<port>" \
TFP_LOGIN_PATH="<the dev-login route from step 2>" \
${LOGIN_POST:+TFP_LOGIN_METHOD=POST TFP_LOGIN_EMAIL="<dev user email>"} \
${ORG:+TFP_ORG="$ORG" TFP_PG_CONTAINER="<container>" TFP_PG_DB="<db>"} \
OUT="$OUT" ${HEADED:+TFP_HEADLESS=false} node "$SCRATCH/run.mjs"
```
Read the `TFP_REPORT` line and the screenshots (`Read $OUT/01-before.png` …). If a selector missed or a state was wrong, fix `run.mjs` and rerun — no permission prompts, ever. If `node` can't resolve `playwright`, confirm the global path (`TFP_PW_GLOBAL`, defaults to `/opt/homebrew/lib/node_modules/`).

### 5. Pick the recording artifact (webm-first)

The runner's `pickVideoArtifact` already emits the choice in the `TFP_REPORT` line as `artifact: { kind, path, bytes, contentType }`:
- **`kind: 'webm'`** when the recording is ≤5 MB — publish the raw webm (higher quality, usually smaller than a GIF, and plays in-browser from the MinIO URL). This is the common case for short tests.
- **`kind: 'gif'`** when the webm exceeds 5 MB — the harness has already transcoded a compressed GIF; publish that.

If you didn't call it in `run.mjs`, run it standalone (it will convert to GIF only if needed):
```bash
TFP_HARNESS="$HOME/.claude/skills/test-feature-pw/lib/harness.mjs" OUT="$OUT" \
  node -e "import(process.env.TFP_HARNESS).then(h => console.log(JSON.stringify(h.pickVideoArtifact(process.env.OUT, { gifName: 'test_<feature>.gif' }))))"
```

### 6. Publish the artifact + report — MinIO upload as in `test-feature` step 7–8

Pull the MinIO uploader secret from the Keychain (never print it) and upload the artifact's `path` to `s3://public` on `https://s3.deploy.sakuga.dev`, keeping the file's real extension in the key: `pr<N>-<timestamp>-<slug>.<webm|gif>`. Pass the content type so the webm streams/plays correctly:
```bash
AWS_ACCESS_KEY_ID="test-feature-uploader" AWS_SECRET_ACCESS_KEY="$MINIO_SECRET" AWS_DEFAULT_REGION="us-east-1" \
  aws s3 cp "<artifact.path>" "s3://public/$KEY" --content-type "<artifact.contentType>" --endpoint-url https://s3.deploy.sakuga.dev
```

Then `gh pr comment` it (or attach to Linear if no PR), embedding by kind:
- **webm** → an HTML `<video>` player, with a plain link as a fallback for clients that strip it:
  ```
  ### Test recording

  <video src="<PUBLIC_URL>" controls muted></video>

  ([vidéo webm](<PUBLIC_URL>) si le lecteur ne s'affiche pas)
  ```
- **gif** → the usual image embed: `![<feature>](<PUBLIC_URL>)`

Confirm the comment landed (`gh pr view --json comments`), then write the concise test report (URL, artifact link, Passed / Issues found / Not tested). Reuse `test-feature`'s exact Keychain/upload/comment commands otherwise — do not reinvent them.

## Important

- Dev server must already be running (step 2) — never start it.
- This skill's only writes are the scratchpad runner/artifacts, the MinIO upload, and the PR/Linear comment. Do **not** modify, stage, or commit the branch or working tree.
- `setActiveOrg` runs a dev-only `UPDATE session` via `docker exec <TFP_PG_CONTAINER>` — local dev data only, never a remote database.
- The harness has **no project defaults**: missing `TFP_BASE`, `TFP_LOGIN_PATH`, `TFP_PG_CONTAINER` or `TFP_PG_DB` raises a named error. If you see one, supply it from step 2 rather than guessing another repo's value.
- Never print the MinIO secret.
- If Playwright genuinely can't launch (missing browser, etc.), report it and fall back to `test-feature`; don't loop.

## Alternative driver: `@playwright/mcp`

The interactive route is also gate-free: register `@playwright/mcp` as an MCP server (`npx @playwright/mcp@latest`), then use its tools (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_start_video`/`browser_stop_video`, `browser_verify_text_visible`, `browser_console_messages`, `browser_network_requests`). It's better for exploratory testing but needs MCP setup and doesn't leave a rerunnable script. This skill defaults to the script approach for determinism and a committable artifact.

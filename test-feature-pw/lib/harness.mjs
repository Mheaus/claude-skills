// Reusable Playwright harness for the `test-feature-pw` (/tfp) skill.
//
// Why this exists: Claude-in-Chrome drives a real browser through an extension
// whose permission gate is flaky (frequent "Permission denied by user") and
// whose captured viewport can get pinned (the 500px `resize_window` gotcha).
// Playwright drives its own Chromium — no extension, no gate, exact viewport,
// native video recording. This module carries the boilerplate (launch, dev
// login, active-org, console/network capture, webm→gif) so a per-feature runner
// script only has to express the interactions + assertions.
//
// Playwright is installed GLOBALLY on this machine (not a repo dependency), so
// we resolve it from the global node_modules via createRequire. `chromium` is
// re-exported for runners that want the raw API.

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PW_GLOBAL = process.env.TFP_PW_GLOBAL ?? '/opt/homebrew/lib/node_modules/';
const require = createRequire(PW_GLOBAL);
export const { chromium } = require('playwright');

// Nothing project-specific is baked in: a default port or container name that only
// fits one repo fails silently everywhere else (wrong port → a timeout that looks
// like a broken selector; wrong container → `docker exec` error swallowed by
// stdio:'ignore'). Anything project-shaped comes from the environment and throws a
// named error when it's missing.
export const DEFAULTS = {
  base: process.env.TFP_BASE,
  viewport: { width: 1440, height: 900 },
  // headless unless TFP_HEADLESS=false (skill exposes a "headed" launch arg).
  headless: process.env.TFP_HEADLESS !== 'false',
  pgContainer: process.env.TFP_PG_CONTAINER,
  pgDb: process.env.TFP_PG_DB,
  pgUser: process.env.TFP_PG_USER ?? 'postgres',
};

function required(value, name, hint) {
  if (value) return value;
  throw new Error(`test-feature-pw: ${name} is required. ${hint}`);
}

/**
 * Launch Chromium and open a page, wiring console-error + /api/ response capture.
 * Records a webm to `outDir` unless `record: false`. Returns the browser/context/
 * page plus the capture arrays and a `close()` that finalizes the video.
 */
export async function openSession({
  outDir,
  headless = DEFAULTS.headless,
  viewport = DEFAULTS.viewport,
  record = true,
} = {}) {
  const browser = await chromium.launch({ headless });
  const ctx = await browser.newContext({
    viewport,
    ...(record && outDir ? { recordVideo: { dir: outDir, size: viewport } } : {}),
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const apiResponses = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('response', (r) => {
    const url = r.url();
    if (url.includes('/api/')) apiResponses.push({ status: r.status(), method: r.request().method(), url });
  });
  return {
    browser,
    ctx,
    page,
    consoleErrors,
    apiResponses,
    async close() {
      await ctx.close(); // finalizes recordVideo
      await browser.close();
    },
  };
}

/**
 * Dev-only login. The route is configuration, not a constant — apps disagree on it,
 * and the two shapes seen so far need different calls:
 *
 *   GET  that sets the cookie by itself   → { path: '/api/dev/login' }
 *   POST that takes an identifier         → { path: '/api/auth/dev-login', method: 'POST',
 *                                             body: { email: 'admin@example.dev' } }
 *
 * Defaults read TFP_LOGIN_PATH / TFP_LOGIN_METHOD / TFP_LOGIN_EMAIL. The POST goes
 * through `page.request`, which shares the context's cookie jar, so the session lands
 * on the browser either way.
 *
 * The legacy `devLogin(page, baseUrl)` form still passes the base, but the path is now
 * required either way — there is no default route that would be right in more than one app.
 */
export async function devLogin(page, opts = {}) {
  const o = typeof opts === 'string' ? { base: opts } : opts;
  const base = required(o.base ?? DEFAULTS.base, 'TFP_BASE', 'Pass the dev server origin, e.g. http://localhost:3000');
  const path = required(
    o.path ?? process.env.TFP_LOGIN_PATH,
    'TFP_LOGIN_PATH',
    "The app's dev-login route, e.g. /api/dev/login (GET) or /api/auth/dev-login (POST).",
  );
  const method = (o.method ?? process.env.TFP_LOGIN_METHOD ?? 'GET').toUpperCase();
  const email = o.body?.email ?? process.env.TFP_LOGIN_EMAIL;

  if (method === 'GET') {
    await page.goto(`${base}${path}`, { waitUntil: 'load' });
    return;
  }
  const payload = o.body ?? (email ? { email } : undefined);
  const res = await page.request.fetch(`${base}${path}`, {
    method,
    ...(payload ? { data: payload } : {}),
  });
  if (!res.ok()) throw new Error(`test-feature-pw: dev login ${method} ${path} returned ${res.status()}`);
}

/**
 * Point the freshly-created dev session at an org. Better Auth's
 * `POST /organization/set-active` needs a CSRF token (403 without it), so for a
 * dev harness we set it directly in the DB. No-op-safe: updates every admin
 * session, which on a dev box is just the DEV_LOGIN user.
 */
export function setActiveOrg(orgId, opts = {}) {
  const { pgUser = DEFAULTS.pgUser, role = 'admin' } = opts;
  const pgContainer = required(
    opts.pgContainer ?? DEFAULTS.pgContainer,
    'TFP_PG_CONTAINER',
    'The local Postgres container name — `docker compose ps` in the repo lists it.',
  );
  const pgDb = required(opts.pgDb ?? DEFAULTS.pgDb, 'TFP_PG_DB', 'The local database name.');
  const sql = `UPDATE session SET active_organization_id='${orgId}' WHERE user_id IN (SELECT id FROM \\"user\\" WHERE role='${role}');`;
  // Not `stdio: 'ignore'`: a wrong container or database used to fail invisibly here,
  // and the run carried on against whatever org the session already had.
  execSync(`docker exec ${pgContainer} psql -U ${pgUser} -d ${pgDb} -c "${sql}"`, { stdio: 'pipe' });
}

/** Absolute path to the context's recorded webm in `outDir` (throws if none). */
export function webmPath(outDir) {
  const webm = readdirSync(outDir).find((f) => f.endsWith('.webm'));
  if (!webm) throw new Error(`No .webm recorded in ${outDir}`);
  return join(outDir, webm);
}

/** Convert the context's recorded webm in `outDir` to an animated GIF via ffmpeg. */
export function toGif(outDir, { fps = 8, width = 900, name = 'recording.gif' } = {}) {
  const gif = join(outDir, name);
  execSync(`ffmpeg -y -i "${webmPath(outDir)}" -vf "fps=${fps},scale=${width}:-1:flags=lanczos" "${gif}"`, {
    stdio: 'ignore',
  });
  return gif;
}

/**
 * Pick the best recording artifact to publish. WebM is far higher quality (and
 * usually smaller) than GIF, so keep the raw webm when it's light enough
 * (default ≤5 MB) and only fall back to a compressed GIF for heavier recordings.
 * Returns `{ kind: 'webm' | 'gif', path, bytes, contentType }`.
 */
export function pickVideoArtifact(
  outDir,
  { maxWebmBytes = 5 * 1024 * 1024, gifName = 'recording.gif', gifOpts = {} } = {},
) {
  const webm = webmPath(outDir);
  const bytes = statSync(webm).size;
  if (bytes <= maxWebmBytes) {
    return { kind: 'webm', path: webm, bytes, contentType: 'video/webm' };
  }
  const gif = toGif(outDir, { ...gifOpts, name: gifName });
  return { kind: 'gif', path: gif, bytes: statSync(gif).size, contentType: 'image/gif' };
}

/** Print a structured report line the skill parses from stdout. */
export function report(obj) {
  console.log('TFP_REPORT ' + JSON.stringify(obj));
}

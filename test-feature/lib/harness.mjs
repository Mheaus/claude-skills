// Playwright harness of the `test-feature` skill (/tf, /tfp): the web driver.
//
// It launches Chromium, records a video, and keeps the console errors, the page errors and the
// HTTP answers of 400 and more. A runner script of one feature imports it and keeps only the
// steps and the checks. See ../drivers.md for when to use it.
//
// Playwright comes from the project under test first (the cwd of the runner, or TFP_PROJECT),
// then from TFP_PW_GLOBAL, then from the global node_modules of npm.

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function loadPlaywright() {
  const roots = [process.env.TFP_PROJECT, process.cwd(), process.env.TFP_PW_GLOBAL];
  try {
    roots.push(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());
  } catch {}
  const tried = [];
  for (const root of roots.filter(Boolean)) {
    for (const name of ['playwright', '@playwright/test']) {
      try {
        const from = existsSync(join(root, 'package.json')) ? join(root, 'package.json') : join(root, 'noop.js');
        return createRequire(from)(name);
      } catch {
        tried.push(`${name} from ${root}`);
      }
    }
  }
  throw new Error(
    `test-feature: Playwright not found. Tried: ${tried.join('; ')}. ` +
      'Run the runner from the project directory, or set TFP_PROJECT or TFP_PW_GLOBAL.',
  );
}

export const { chromium } = loadPlaywright();

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
  throw new Error(`test-feature: ${name} is required. ${hint}`);
}

/**
 * Launch Chromium and open a page. Keeps the console errors, the page errors and the HTTP errors.
 * Records a webm to `outDir` unless `record: false`. Returns the browser/context/
 * page plus the capture arrays and a `close()` that finalizes the video.
 */
export async function openSession({
  outDir,
  headless = DEFAULTS.headless,
  viewport = DEFAULTS.viewport,
  record = true,
} = {}) {
  // `TFP_CHANNEL=chrome` launches the installed Google Chrome when Playwright's own Chromium is
  // not downloaded (`npx playwright install` refused, or a repo that pins `channel: 'chrome'`).
  const browser = await chromium.launch({
    headless,
    ...(process.env.TFP_CHANNEL ? { channel: process.env.TFP_CHANNEL } : {}),
  });
  const ctx = await browser.newContext({
    viewport,
    ...(record && outDir ? { recordVideo: { dir: outDir, size: viewport } } : {}),
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const httpErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('response', (r) => {
    if (r.status() >= 400) httpErrors.push({ status: r.status(), method: r.request().method(), url: r.url() });
  });
  return {
    browser,
    ctx,
    page,
    consoleErrors,
    pageErrors,
    httpErrors,
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
  if (!res.ok()) throw new Error(`test-feature: dev login ${method} ${path} returned ${res.status()}`);
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

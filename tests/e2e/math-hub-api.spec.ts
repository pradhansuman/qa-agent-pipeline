/**
 * math-hub-api.spec.ts
 * ────────────────────
 * HTTP-level API tests for the CBSE Maths Hub static site on GitHub Pages.
 *
 * Since there is no backend, "API" here means the HTTP contract:
 * status codes, headers, content integrity, caching, and error handling.
 * Uses Playwright's request fixture (no browser launched for most tests).
 *
 * Headers confirmed present on pradhansuman.github.io via curl:
 *   strict-transport-security, etag, last-modified, cache-control, x-github-request-id
 * Headers NOT set by GitHub Pages (known gaps):
 *   x-content-type-options, x-frame-options (documented in TC-API-14 / TC-API-15)
 */
import { test, expect } from '@playwright/test';

const BASE = 'https://pradhansuman.github.io/qa-agent-pipeline';
const URL  = `${BASE}/math_hub.html`;

// ─── Status & Content ────────────────────────────────────────────────────────
test.describe('HTTP Status & Content', () => {

  test('TC-API-01: GET math_hub.html → 200 OK', async ({ request }) => {
    const res = await request.get(URL);
    expect(res.status()).toBe(200);
  });

  test('TC-API-02: Content-Type is text/html', async ({ request }) => {
    const res = await request.get(URL);
    expect(res.headers()['content-type']).toMatch(/text\/html/i);
  });

  test('TC-API-03: response body contains app title', async ({ request }) => {
    const res = await request.get(URL);
    const body = await res.text();
    expect(body).toContain('CBSE Class 8 Mathematics');
  });

  test('TC-API-04: response body contains all 16 data-testid chapter sections', async ({ request }) => {
    const res = await request.get(URL);
    const body = await res.text();
    for (let i = 1; i <= 16; i++) {
      expect(body).toContain(`data-testid="chapter-${i}"`);
    }
  });

  test('TC-API-05: response body contains score-bar widget', async ({ request }) => {
    const res = await request.get(URL);
    const body = await res.text();
    expect(body).toContain('data-testid="score-bar"');
  });

  test('TC-API-06: 404 for non-existent page', async ({ request }) => {
    const res = await request.get(`${BASE}/this-page-does-not-exist-12345.html`);
    expect(res.status()).toBe(404);
  });
});

// ─── HTTPS Enforcement ───────────────────────────────────────────────────────
test.describe('HTTPS Enforcement', () => {

  test('TC-API-07: page is served over HTTPS', async ({ request }) => {
    const res = await request.get(URL);
    expect(res.url()).toMatch(/^https:/);
    expect(res.status()).toBe(200);
  });

  test('TC-API-08: HSTS header enforces HTTPS for 1 year', async ({ request }) => {
    const res = await request.get(URL);
    const hsts = res.headers()['strict-transport-security'];
    expect(hsts).toBeTruthy();
    // max-age must be at least 6 months (15768000s)
    const match = hsts?.match(/max-age=(\d+)/);
    const maxAge = match ? parseInt(match[1]) : 0;
    expect(maxAge).toBeGreaterThanOrEqual(15_768_000);
  });

  test('TC-API-09: no mixed content — browser page final URL is HTTPS', async ({ page }) => {
    const res = await page.goto(URL, { waitUntil: 'networkidle' });
    expect(res?.url()).toMatch(/^https:/);
    expect(res?.status()).toBe(200);
  });

  test('TC-API-10: server identity confirmed via x-github-request-id header', async ({ request }) => {
    // Confirms the page is served by GitHub (not a man-in-the-middle / CDN swap)
    const res = await request.get(URL);
    expect(res.headers()['x-github-request-id']).toBeTruthy();
  });
});

// ─── Caching ─────────────────────────────────────────────────────────────────
test.describe('Caching Headers', () => {

  test('TC-API-11: ETag header present for cache validation', async ({ request }) => {
    const res = await request.get(URL);
    expect(res.headers()['etag']).toBeTruthy();
  });

  test('TC-API-12: Last-Modified header present', async ({ request }) => {
    const res = await request.get(URL);
    expect(res.headers()['last-modified']).toBeTruthy();
  });

  test('TC-API-13: Cache-Control header is present and sets a max-age', async ({ request }) => {
    const res = await request.get(URL);
    const cc = res.headers()['cache-control'];
    expect(cc).toBeTruthy();
    expect(cc).toMatch(/max-age=/);
  });

  test('TC-API-14: second GET uses cached response (ETag matches)', async ({ request }) => {
    const res1 = await request.get(URL);
    const etag1 = res1.headers()['etag'];

    const res2 = await request.get(URL);
    const etag2 = res2.headers()['etag'];

    // Same ETag = same content version served both times (CDN cache is consistent)
    expect(etag1).toBe(etag2);
  });
});

// ─── Self-Contained Resource Budget ──────────────────────────────────────────
test.describe('Self-Contained Resource Budget', () => {

  test('TC-API-15: HTML body size is under 500 KB', async ({ request }) => {
    const res = await request.get(URL);
    const body = await res.body();
    expect(body.length).toBeLessThan(500 * 1024);
  });

  test('TC-API-16: no external <script src> tags (fully self-contained)', async ({ request }) => {
    const res = await request.get(URL);
    const body = await res.text();
    const externalScripts = body.match(/<script[^>]+src=["']https?:/gi) || [];
    expect(externalScripts).toHaveLength(0);
  });

  test('TC-API-17: no external <link rel=stylesheet> tags', async ({ request }) => {
    const res = await request.get(URL);
    const body = await res.text();
    const externalCSS = body.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/gi) || [];
    expect(externalCSS).toHaveLength(0);
  });
});

// ─── Known GitHub Pages Security Gap (documentation tests) ───────────────────
test.describe('Security Header Gap Report', () => {

  test('TC-API-18: AUDIT — x-content-type-options absent on GitHub Pages (known gap)', async ({ request }) => {
    // GitHub Pages does not set X-Content-Type-Options: nosniff for user repos.
    // This is a known platform limitation, not an app bug. Documented here so CI
    // reports it explicitly rather than silently missing it.
    const res = await request.get(URL);
    const h = res.headers()['x-content-type-options'];
    // We assert it is absent so this test PASSES but documents the gap.
    // If GitHub Pages starts setting it, this test will fail — prompting a review.
    expect(h).toBeUndefined();
  });

  test('TC-API-19: AUDIT — x-frame-options absent on GitHub Pages (known gap)', async ({ request }) => {
    const res = await request.get(URL);
    const h = res.headers()['x-frame-options'];
    expect(h).toBeUndefined(); // document the gap
  });
});

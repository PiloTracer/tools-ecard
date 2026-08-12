// @ts-nocheck — Playwright types resolve after `npm run test:e2e:install`
import { test, expect } from '@playwright/test';

/**
 * Smoke tests for critical navigation paths.
 * Requires the dev stack (or PLAYWRIGHT_BASE_URL) with front-cards reachable.
 */
test.describe('E-Cards smoke', () => {
  test('home or login page loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard route responds', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBeLessThan(500);
  });

  test('demo route loads when configured', async ({ page }) => {
    const response = await page.goto('/demo');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('downloadable import templates are served (Pass 1)', async ({ page }) => {
    for (const name of ['import-template-horizontal.xlsx', 'import-template-vertical.xlsx']) {
      const response = await page.request.get(`/templates/${name}`);
      expect(response.status()).toBe(200);
      // XLSX is a ZIP container — assert the PK magic bytes.
      const body = await response.body();
      expect(body.length).toBeGreaterThan(100);
      expect(body[0]).toBe(0x50); // 'P'
      expect(body[1]).toBe(0x4b); // 'K'
    }
  });

  test('bundled global templates listing is served and valid (Pass 5)', async ({ page }) => {
    const response = await page.request.get('/api/bundled-templates');
    expect(response.status()).toBe(200);
    const listing = await response.json();
    for (const group of ['shared', 'demo', 'prd'] as const) {
      expect(Array.isArray(listing[group])).toBe(true);
      for (const entry of listing[group]) {
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.file).toBe('string');
      }
    }
  });

  test('template gallery survives a failing bundled-templates listing', async ({ page }) => {
    // Demo mode flag (localStorage key from features/demo/demoConstants.ts) so the
    // gallery reads browser storage instead of the auth-gated API.
    await page.addInitScript(() => {
      window.localStorage.setItem('ecards:demo:enabled', '1');
    });
    // Corrupt listing: the bundled loader must skip it with a console warning,
    // never break the gallery.
    await page.route('**/api/bundled-templates', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{corrupt-json' })
    );

    // /template-textile/test-colors renders the full designer without ProtectedRoute.
    const response = await page.goto('/template-textile/test-colors');
    expect(response?.status()).toBeLessThan(500);

    await page.getByTitle('Open Template', { exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Open Template' })).toBeVisible();
    // Loading finishes and the gallery renders content or the empty state —
    // crucially, not the error banner caused by the corrupt manifest.
    await expect(page.getByText('Loading templates...')).toBeHidden({ timeout: 15000 });
    await expect(page.getByText(/Failed to load templates/)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });
});

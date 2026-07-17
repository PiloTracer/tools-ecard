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
});

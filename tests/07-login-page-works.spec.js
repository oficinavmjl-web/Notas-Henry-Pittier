const { test, expect } = require('@playwright/test');

test('login page renders the form and auth scripts', async ({ page }) => {
  await page.goto('/pages/login.html');

  await expect(page.locator('form#loginForm')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();

  const scriptSources = await page.locator('script').evaluateAll(nodes => nodes.map(node => node.src));
  const hasAuthScript = scriptSources.some(src => src.includes('auth.js'));
  const hasSupabaseScript = scriptSources.some(src => src.includes('supabase.js'));

  expect(hasAuthScript).toBeTruthy();
  expect(hasSupabaseScript).toBeTruthy();
});

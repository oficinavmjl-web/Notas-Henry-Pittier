const { test, expect } = require('@playwright/test');

test('login page basic elements present', async ({ page }) => {
  await page.goto('/pages/login.html');
  // Form presence
  const form = page.locator('form#loginForm, form');
  await expect(form).toBeVisible();
  // Inputs
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
});

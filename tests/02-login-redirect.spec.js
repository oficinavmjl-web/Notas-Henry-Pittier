const { test, expect } = require('@playwright/test');

test('login redirects based on role (UI elements only)', async ({ page }) => {
  await page.goto('/pages/login.html');
  // Comprobar inputs y botón
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"], button#btnLogin')).toBeVisible();
  // Verificar que existe lógica de redirección por rol en scripts
  const scripts = await page.locator('script[src], script').allTextContents();
  const joined = scripts.join('\n');
  expect(joined.toLowerCase()).toContain('redirigirporrol'.toLowerCase());
});

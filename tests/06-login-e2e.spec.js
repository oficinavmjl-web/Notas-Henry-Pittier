const { test, expect } = require('@playwright/test');

test('login E2E con credenciales suministradas (Superadmin)', async ({ page }) => {
  await page.goto('/index.html');
  await page.fill('#email', 'controlestudios_etahp@proton.me');
  await page.fill('#password', '123456');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  // Tras login, la app redirige por rol. Comprobar que estamos en alguna página de dashboard
  const url = page.url();
  expect(url).toMatch(/\/pages\/(superadmin|directivo|evaluacion_docente|docente|control_estudios)\//i);
});

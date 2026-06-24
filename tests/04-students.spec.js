const { test, expect } = require('@playwright/test');

test('estudiantes - flujo básico UI', async ({ page }) => {
  await page.goto('/pages/estudiantes.html');
  // Verificar lista y botones de acción
  await expect(page.locator('table#tablaEstudiantes, table')).toBeVisible();
  await expect(page.locator('button#btnCrearEstudiante, button[data-action="crear-estudiante"]')).toBeVisible();
  // Verificar modal de creación si existe
  const crearBtn = page.locator('button#btnCrearEstudiante, button[data-action="crear-estudiante"]');
  if (await crearBtn.count() > 0) await crearBtn.first().click();
  const modal = page.locator('.modal');
  if (await modal.count() > 0) await expect(modal).toBeVisible();
});

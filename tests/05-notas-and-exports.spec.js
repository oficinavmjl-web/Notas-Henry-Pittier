const { test, expect } = require('@playwright/test');

test('cargar notas y export buttons exist', async ({ page }) => {
  await page.goto('/pages/docente/cargar-notas.html');
  await expect(page.locator('form#cargarNotasForm, form')).toBeVisible();
  await expect(page.locator('button#btnGuardarNotas, button[data-action="guardar-notas"]')).toBeVisible();
  // Export buttons on docente dashboard
  await page.goto('/pages/docente.html');
  await expect(page.locator('button#btnExportPlanillaXLSX')).toBeVisible();
  await expect(page.locator('button#btnExportSabanaXLSX')).toBeVisible();
});

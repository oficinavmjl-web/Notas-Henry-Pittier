const { test, expect } = require('@playwright/test');

test('usuarios - formulario crear/editar visible', async ({ page }) => {
  await page.goto('/pages/docente.html');
  // Navegar al módulo usuarios si hay enlace
  const usersLink = page.locator('a[href*="usuarios"], [data-module="usuarios"]');
  if (await usersLink.count() > 0) await usersLink.first().click();
  // Comprobar presencia de tabla y botón crear
  await expect(page.locator('table#tablaUsuarios, table')).toBeVisible();
  await expect(page.locator('button#btnCrearUsuario, button[data-action="crear-usuario"]')).toBeVisible();
});

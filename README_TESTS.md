**E2E (Playwright) — instrucciones rápidas**

Instalación:

```bash
npm install
npx playwright install --with-deps
```

Ejecutar tests:

```bash
npm test
```

Notas:
- `baseURL` en `playwright.config.js` apunta a `http://localhost:3000`. Ajusta según tu servidor local.
- Muchas pruebas requieren credenciales y/o que las Edge Functions estén accesibles. Proporciona variables de entorno o crea fixtures según necesites.

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: 'tests',
  timeout: 30000,
  use: {
    headless: true,
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
};

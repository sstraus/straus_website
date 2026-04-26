const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  use: {
    baseURL: 'http://localhost:7080',
  },
  webServer: {
    command: 'python3 -m http.server 7080',
    port: 7080,
    reuseExistingServer: true,
  },
});

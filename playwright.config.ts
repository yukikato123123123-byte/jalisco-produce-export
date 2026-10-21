import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 30000,
  use: { baseURL: 'http://localhost:8787', launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'npm run dev:worker', url: 'http://localhost:8787', reuseExistingServer: false, timeout: 60000, env: { WRANGLER_SEND_METRICS: 'false' } },
});

import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'public-continuation.spec.ts',
  timeout: 60_000, fullyParallel: true, workers: 2,
  outputDir: './evidence/continuation-artifacts',
  reporter: [['list'], ['json', { outputFile: './evidence/continuation-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:5175', locale: 'fr-MA', timezoneId: 'Africa/Casablanca',
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile360', use: { viewport: { width: 360, height: 800 }, hasTouch: true } },
  ],
});

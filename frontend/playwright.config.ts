import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

// Business specs run against a real backend on :8100 with its own throwaway database and the AI turned off,
// so they never touch the development database on :8000.
export const TEST_API = 'http://127.0.0.1:8100';
const testDb = path.join(os.tmpdir(), `shipsure-e2e-${process.pid}.db`);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run start -- --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'backend/venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8100',
      cwd: '..',
      url: `${TEST_API}/health`,
      reuseExistingServer: false,
      env: { SHIPSURE_DATABASE_URL: `sqlite:///${testDb}`, ASSISTANT_MODE: 'offline', CORS_ORIGINS: 'http://127.0.0.1:3100' },
    },
  ],
});

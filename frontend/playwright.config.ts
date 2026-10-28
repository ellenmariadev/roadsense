import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { E2E_USERS } from './e2e/test-users';

const frontendDir = __dirname;
const repoRoot = path.resolve(frontendDir, '..');
const rootEnvFile = path.join(repoRoot, '.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

function e2eDatabaseUrl(): string {
  const base =
    process.env.DATABASE_URL ??
    'postgresql://road_sense:road_sense@localhost:5433/road_sense?schema=public';
  const url = new URL(base);
  url.searchParams.set('schema', 'roadsense_e2e');
  return url.toString();
}

const apiEnv = {
  ...process.env,
  NODE_ENV: 'test',
  APP_PORT: '3210',
  DATABASE_URL: e2eDatabaseUrl(),
  JWT_SECRET:
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
      ? process.env.JWT_SECRET
      : 'road-sense-e2e-only-jwt-secret-at-least-32-chars',
  JWT_EXPIRES_IN: '1h',
  LLM_PROVIDER: 'mock',
  SEED_ADMIN_EMAIL: E2E_USERS.admin.email,
  SEED_ADMIN_PASSWORD: E2E_USERS.admin.password,
  SEED_OPERATOR_EMAIL: E2E_USERS.operator.email,
  SEED_OPERATOR_PASSWORD: E2E_USERS.operator.password,
  SEED_VIEWER_EMAIL: E2E_USERS.viewer.email,
  SEED_VIEWER_PASSWORD: E2E_USERS.viewer.password,
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3211',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run e2e:api',
      cwd: repoRoot,
      url: 'http://127.0.0.1:3210/api/v1/health/ready',
      timeout: 180_000,
      reuseExistingServer: false,
      env: apiEnv,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npm run build && npm run start:e2e',
      cwd: frontendDir,
      url: 'http://127.0.0.1:3211/login',
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ROADSENSE_API_URL: 'http://127.0.0.1:3210',
      },
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});

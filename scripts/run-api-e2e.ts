import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

if (existsSync('.env') && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const base =
  process.env.DATABASE_URL ??
  'postgresql://road_sense:road_sense@localhost:5433/road_sense?schema=public';
const databaseUrl = new URL(base);
databaseUrl.searchParams.set('schema', 'roadsense_e2e');

const e2eEnv = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl.toString(),
  JWT_SECRET:
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
      ? process.env.JWT_SECRET
      : 'road-sense-e2e-only-jwt-secret-at-least-32-chars',
  JWT_EXPIRES_IN: '1h',
  LLM_PROVIDER: 'mock',
  SEED_ADMIN_EMAIL: 'e2e-admin@roadsense.local',
  SEED_ADMIN_PASSWORD: 'E2E-admin-password-123',
  SEED_OPERATOR_EMAIL: 'e2e-operator@roadsense.local',
  SEED_OPERATOR_PASSWORD: 'E2E-operator-password-123',
  SEED_VIEWER_EMAIL: 'e2e-viewer@roadsense.local',
  SEED_VIEWER_PASSWORD: 'E2E-viewer-password-123',
};

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: path.resolve(__dirname, '..'),
    env: e2eEnv,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(npx, ['prisma', 'migrate', 'reset', '--force', '--skip-seed']);
run(npm, ['run', 'prisma:seed']);
run(npx, ['jest', '--config', './test/jest-e2e.json', '--runInBand', ...process.argv.slice(2)]);

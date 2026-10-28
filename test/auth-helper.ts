import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export interface TestTokens {
  admin: string;
  operator: string;
  viewer: string;
}

function requiredTestCredential(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} in the untracked local .env before running database e2e tests.`);
  }
  return value;
}

export const SEED_CREDENTIALS = {
  admin: {
    email: requiredTestCredential('SEED_ADMIN_EMAIL'),
    password: requiredTestCredential('SEED_ADMIN_PASSWORD'),
  },
  operator: {
    email: requiredTestCredential('SEED_OPERATOR_EMAIL'),
    password: requiredTestCredential('SEED_OPERATOR_PASSWORD'),
  },
  viewer: {
    email: requiredTestCredential('SEED_VIEWER_EMAIL'),
    password: requiredTestCredential('SEED_VIEWER_PASSWORD'),
  },
};

export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return response.body.accessToken as string;
}

export async function loginAll(app: INestApplication): Promise<TestTokens> {
  return {
    admin: await login(app, SEED_CREDENTIALS.admin.email, SEED_CREDENTIALS.admin.password),
    operator: await login(app, SEED_CREDENTIALS.operator.email, SEED_CREDENTIALS.operator.password),
    viewer: await login(app, SEED_CREDENTIALS.viewer.email, SEED_CREDENTIALS.viewer.password),
  };
}

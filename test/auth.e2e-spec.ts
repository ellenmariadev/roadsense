import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication and authorization (e2e)', () => {
  let app: INestApplication;
  const password = 'correct-development-password';
  const users = [
    { id: 'admin-id', email: 'admin@test.local', role: UserRole.ADMIN },
    { id: 'operator-id', email: 'operator@test.local', role: UserRole.OPERATOR },
    { id: 'viewer-id', email: 'viewer@test.local', role: UserRole.VIEWER },
  ];
  let passwordHash: string;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    incident: {
      findUnique: jest.fn(),
    },
    incidentEvent: {
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4);
    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { id?: string; email?: string } }) => {
        const user = users.find((candidate) =>
          where.id ? candidate.id === where.id : candidate.email === where.email,
        );
        return user ? { ...user, name: null, passwordHash } : null;
      },
    );
    prismaMock.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'created-user-id',
      email: data.email,
      name: data.name ?? null,
      role: data.role ?? UserRole.VIEWER,
      passwordHash: data.passwordHash,
    }));
    prismaMock.incident.findUnique.mockResolvedValue({ id: 'incident-id' });
    prismaMock.incidentEvent.findMany.mockResolvedValue([
      { id: 'event-id', incidentId: 'incident-id', type: 'INCIDENT_CREATED' },
    ]);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { swagger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function tokenFor(role: UserRole): Promise<string> {
    const user = users.find((candidate) => candidate.role === role)!;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  it('rejects unauthenticated protected requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/incidents/incident-id').expect(401);
  });

  it('rejects invalid credentials without revealing which credential failed', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: users[0].email, password: 'wrong-password' })
      .expect(401);

    expect(response.body.message).toBe('Invalid credentials');
  });

  it('allows only ADMIN to register users', async () => {
    const operatorToken = await tokenFor(UserRole.OPERATOR);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ email: 'blocked@test.local', password })
      .expect(403);

    const adminToken = await tokenFor(UserRole.ADMIN);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'created@test.local', password })
      .expect(201);
  });

  it('allows every role to read protected incident history', async () => {
    for (const role of [UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER]) {
      const token = await tokenFor(role);
      const response = await request(app.getHttpServer())
        .get('/api/v1/incidents/incident-id/events')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    }
  });

  it('forbids VIEWER from an operator operation while allowing OPERATOR', async () => {
    const viewerToken = await tokenFor(UserRole.VIEWER);
    await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ originalReport: 'Relato fictício para teste.' })
      .expect(403);
  });
});

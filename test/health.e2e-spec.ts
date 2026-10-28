import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
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

  describe('GET /api/v1/health', () => {
    it('returns 200 with status ok', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('returns 200 when the database is reachable', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.checks.database).toBe('up');
    });

    it('returns 503 when the database is unavailable', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));

      const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.checks.database).toBe('down');
    });
  });
});

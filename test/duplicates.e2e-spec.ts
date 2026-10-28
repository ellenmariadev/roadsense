import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { loginAll, TestTokens } from './auth-helper';

function uniqueRoad(): string {
  return `BR-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function report(road: string): Record<string, unknown> {
  return {
    originalReport: `Colisão entre dois veículos de passeio na ${road}, km 245.`,
    roadName: road,
    kilometerMarker: '245',
    incidentType: 'ACCIDENT',
    description: 'Colisão entre dois veículos de passeio',
  };
}

describe('Duplicate candidates (e2e, real database)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const createdIncidentIds: string[] = [];
  let tokens: TestTokens;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { swagger: false });
    await app.init();

    tokens = await loginAll(app);
  });

  afterAll(async () => {
    if (createdIncidentIds.length > 0) {
      await prisma.incident.deleteMany({ where: { id: { in: createdIncidentIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  async function createIncident(body: Record<string, unknown>): Promise<any> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${tokens.operator}`)
      .send(body)
      .expect(201);
    createdIncidentIds.push(response.body.id);
    return response.body;
  }

  it('detects a true duplicate candidate with explainable signals', async () => {
    const road = uniqueRoad();
    const a = await createIncident(report(road));
    const b = await createIncident({
      ...report(road),
      description: 'Colisão de dois veículos na pista',
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${a.id}/duplicate-candidates`)
      .set('Authorization', `Bearer ${tokens.viewer}`)
      .expect(200);

    const candidate = response.body.candidates.find((c: any) => c.incident.id === b.id);
    expect(candidate).toBeDefined();
    expect(candidate.score).toBeGreaterThanOrEqual(0.5);
    expect(candidate.signals.road.value).toBe('match');
    expect(candidate.signals.incidentType.value).toBe('match');
  });

  it('does not flag unrelated incidents as candidates', async () => {
    const a = await createIncident(report(uniqueRoad()));
    await createIncident({
      originalReport: 'Alagamento severo em rodovia estadual.',
      roadName: uniqueRoad(),
      kilometerMarker: '900',
      incidentType: 'FLOODING',
      description: 'Alagamento severo na rodovia',
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${a.id}/duplicate-candidates`)
      .set('Authorization', `Bearer ${tokens.operator}`)
      .expect(200);

    expect(response.body.candidates).toHaveLength(0);
  });

  it('handles missing location data without false matches', async () => {
    const a = await createIncident(report(uniqueRoad()));
    await createIncident({
      originalReport: 'Algo na pista sem localização definida.',
      roadName: null,
      kilometerMarker: null,
      incidentType: 'OTHER',
      description: null,
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${a.id}/duplicate-candidates`)
      .set('Authorization', `Bearer ${tokens.operator}`)
      .expect(200);

    expect(response.body.candidates).toHaveLength(0);
  });

  it('confirms a candidate as a duplicate without changing incident status', async () => {
    const road = uniqueRoad();
    const a = await createIncident(report(road));
    const b = await createIncident({
      ...report(road),
      description: 'Colisão de dois veículos na pista',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${a.id}/duplicate-candidates/${b.id}/confirm`)
      .set('Authorization', `Bearer ${tokens.operator}`)
      .expect(200);

    const incidentA = await prisma.incident.findUnique({ where: { id: a.id } });

    // Confirmation is a recorded relationship, never a status change.
    expect(incidentA?.status).toBe('REPORTED');

    const response = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${a.id}/duplicate-candidates`)
      .set('Authorization', `Bearer ${tokens.operator}`)
      .expect(200);

    expect(response.body.candidates.find((c: any) => c.incident.id === b.id)).toBeUndefined();
    expect(response.body.confirmed.find((c: any) => c.incident.id === b.id)).toBeDefined();
  });

  it('rejects a candidate and records it as rejected', async () => {
    const road = uniqueRoad();
    const a = await createIncident(report(road));
    const b = await createIncident({
      ...report(road),
      description: 'Colisão de dois veículos na pista',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${a.id}/duplicate-candidates/${b.id}/reject`)
      .set('Authorization', `Bearer ${tokens.operator}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${a.id}/duplicate-candidates`)
      .set('Authorization', `Bearer ${tokens.operator}`)
      .expect(200);

    expect(response.body.rejected.find((c: any) => c.incident.id === b.id)).toBeDefined();
  });

  it('forbids confirmation by a VIEWER', async () => {
    const road = uniqueRoad();
    const a = await createIncident(report(road));
    const b = await createIncident({
      ...report(road),
      description: 'Colisão de dois veículos na pista',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${a.id}/duplicate-candidates/${b.id}/confirm`)
      .set('Authorization', `Bearer ${tokens.viewer}`)
      .expect(403);
  });

  it('rejects confirming an incident as a duplicate of itself', async () => {
    const a = await createIncident(report(uniqueRoad()));

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${a.id}/duplicate-candidates/${a.id}/confirm`)
      .set('Authorization', `Bearer ${tokens.operator}`)
      .expect(409);
  });

  it('rejects confirming a pair that is not a candidate', async () => {
    const a = await createIncident(report(uniqueRoad()));
    const unrelated = await createIncident({
      originalReport: 'Incidente totalmente diferente.',
      roadName: uniqueRoad(),
      kilometerMarker: '900',
      incidentType: 'FLOODING',
      description: 'Alagamento severo na rodovia',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${a.id}/duplicate-candidates/${unrelated.id}/confirm`)
      .set('Authorization', `Bearer ${tokens.operator}`)
      .expect(409);
  });
});

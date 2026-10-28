import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { LLM_PROVIDER, LlmProviderError } from '../src/ai/llm-provider.interface';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { loginAll } from './auth-helper';

const ACCIDENT_REPORT = 'Colisão entre dois veículos na BR-116, km 245, sentido sul, há vítimas.';

async function createApp(overrideProvider?: boolean): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  if (overrideProvider) {
    builder.overrideProvider(LLM_PROVIDER).useValue({
      provider: 'fake',
      model: 'fake-v1',
      extract: jest.fn().mockRejectedValue(new LlmProviderError('boom')),
    });
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, { swagger: false });
  await app.init();
  return app;
}

describe('Incidents and Triage (e2e, real database)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let operatorToken: string;
  let viewerToken: string;

  const createdIncidentIds: string[] = [];
  const createdTriageRunIds: string[] = [];

  beforeAll(async () => {
    app = await createApp();
    const tokens = await loginAll(app);
    operatorToken = tokens.operator;
    viewerToken = tokens.viewer;
  });

  afterAll(async () => {
    if (createdTriageRunIds.length > 0) {
      await prisma.triageRun.deleteMany({ where: { id: { in: createdTriageRunIds } } });
    }
    if (createdIncidentIds.length > 0) {
      await prisma.incident.deleteMany({ where: { id: { in: createdIncidentIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  async function createIncident(sourceText = ACCIDENT_REPORT): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ originalReport: sourceText })
      .expect(201);
    createdIncidentIds.push(response.body.id);
    return response.body.id;
  }

  async function runTriage(incidentId: string, sourceText = ACCIDENT_REPORT): Promise<any> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/triage')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ sourceText, incidentId })
      .expect(201);
    createdTriageRunIds.push(response.body.id);
    return response.body;
  }

  it('allows manual incident creation without any AI', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ originalReport: 'Falha mecânica na SP-330, km 87.' })
      .expect(201);

    createdIncidentIds.push(response.body.id);
    expect(response.body.status).toBe('REPORTED');
    expect(response.body.priority).toBe('LOW');
  });

  it('lists incidents with text search and pagination', async () => {
    const marker = `LIST-${Date.now()}`;
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        originalReport: `Óleo derramado na pista. Marcador ${marker}.`,
        roadName: 'BR-000',
      })
      .expect(201);
    createdIncidentIds.push(createResponse.body.id);

    const response = await request(app.getHttpServer())
      .get('/api/v1/incidents')
      .query({ q: marker, page: 1, limit: 5 })
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(5);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(createResponse.body.id);
    expect(response.body.items[0].roadName).toBe('BR-000');
  });

  it('validates incident list pagination filters', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/incidents')
      .query({ limit: 101 })
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(400);
  });

  it('updates permitted incident fields and recalculates priority with audit events', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ originalReport: 'Registro inicial sem classificação.', incidentType: 'OTHER' })
      .expect(201);
    createdIncidentIds.push(createResponse.body.id);
    expect(createResponse.body.priority).toBe('LOW');

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        incidentType: 'ACCIDENT',
        description: 'Descrição operacional revisada.',
        roadName: 'BR-101',
        riskFactors: ['vítima no local'],
      })
      .expect(200);

    expect(response.body.incidentType).toBe('ACCIDENT');
    expect(response.body.description).toBe('Descrição operacional revisada.');
    expect(response.body.roadName).toBe('BR-101');
    expect(response.body.riskFactors).toEqual(['vítima no local']);
    expect(response.body.priority).toBe('CRITICAL');

    const eventsResponse = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${createResponse.body.id}/events`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    const eventTypes = eventsResponse.body.map((event: { type: string }) => event.type);
    expect(eventTypes).toContain('ATTRIBUTE_CHANGED');
    expect(eventTypes).toContain('PRIORITY_CHANGED');
    const attributeEvent = eventsResponse.body.find(
      (event: { type: string }) => event.type === 'ATTRIBUTE_CHANGED',
    );
    expect(attributeEvent.metadata.changedFields).toEqual(
      expect.arrayContaining(['incidentType', 'description', 'roadName', 'riskFactors']),
    );
    expect(attributeEvent.metadata.before.incidentType).toBe('OTHER');
    expect(attributeEvent.metadata.after.incidentType).toBe('ACCIDENT');
  });

  it('rejects direct status or priority changes through PATCH', async () => {
    const incidentId = await createIncident();

    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ priority: 'CRITICAL' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({})
      .expect(400);
  });

  it('forbids incident updates by a VIEWER', async () => {
    const incidentId = await createIncident();

    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ description: 'Tentativa não autorizada.' })
      .expect(403);
  });

  it('applies a valid status sequence and records resolution', async () => {
    const incidentId = await createIncident();

    const available = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/available-transitions`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(available.body.current).toBe('REPORTED');
    expect(available.body.allowed).toEqual(
      expect.arrayContaining(['UNDER_REVIEW', 'CONFIRMED', 'CANCELLED']),
    );
    expect(available.body.allowed).not.toContain('RESOLVED');

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/transitions`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ to: 'UNDER_REVIEW' })
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('UNDER_REVIEW'));

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/transitions`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ to: 'CONFIRMED' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/transitions`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ to: 'IN_PROGRESS' })
      .expect(200);

    const resolved = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/transitions`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ to: 'RESOLVED', reason: 'Pista liberada.' })
      .expect(200);

    expect(resolved.body.status).toBe('RESOLVED');
    expect(resolved.body.resolvedAt).toEqual(expect.any(String));

    const eventsResponse = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/events`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    const resolution = eventsResponse.body.find(
      (event: { type: string }) => event.type === 'RESOLVED',
    );
    expect(resolution.metadata).toEqual({
      from: 'IN_PROGRESS',
      to: 'RESOLVED',
      reason: 'Pista liberada.',
    });
  });

  it('rejects invalid, repeated, and missing status transitions', async () => {
    const incidentId = await createIncident();

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/transitions`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ to: 'RESOLVED' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/transitions`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ to: 'REPORTED' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/transitions`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ to: 'NOT_A_STATUS' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/transitions`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/incidents/00000000-0000-4000-8000-999999999999/transitions')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ to: 'UNDER_REVIEW' })
      .expect(404);
  });

  it('forbids status transitions by a VIEWER', async () => {
    const incidentId = await createIncident();

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/transitions`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ to: 'UNDER_REVIEW' })
      .expect(403);
  });

  it('scopes idempotency keys and rejects payload reuse', async () => {
    const incidentId = await createIncident();
    const idempotencyKey = `idem-${Date.now()}`;

    const first = await request(app.getHttpServer())
      .post('/api/v1/triage')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ sourceText: ACCIDENT_REPORT, incidentId, idempotencyKey })
      .expect(201);
    createdTriageRunIds.push(first.body.id);

    const repeated = await request(app.getHttpServer())
      .post('/api/v1/triage')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ sourceText: ACCIDENT_REPORT, incidentId, idempotencyKey })
      .expect(201);

    expect(repeated.body.id).toBe(first.body.id);

    await request(app.getHttpServer())
      .post('/api/v1/triage')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ sourceText: 'Payload diferente.', incidentId, idempotencyKey })
      .expect(409);

    const eventsResponse = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/events`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(
      eventsResponse.body.filter((event: { type: string }) => event.type === 'TRIAGE_EXECUTED'),
    ).toHaveLength(1);
  });

  it('rejects a triage run linked to a missing incident', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/triage')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        sourceText: ACCIDENT_REPORT,
        incidentId: '00000000-0000-4000-8000-999999999999',
      })
      .expect(404);
  });

  it('executes AI triage and persists a structured suggestion', async () => {
    const incidentId = await createIncident();
    const triage = await runTriage(incidentId);

    expect(triage.status).toBe('SUCCEEDED');
    expect(triage.provider).toBe('mock');
    expect(triage.suggestedIncidentType).toBe('ACCIDENT');
    expect(triage.suggestedRoadName).toBe('BR-116');
  });

  it('retrieves a triage execution by id', async () => {
    const incidentId = await createIncident();
    const triage = await runTriage(incidentId);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/triage/${triage.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(response.body.id).toBe(triage.id);
    expect(response.body.status).toBe('SUCCEEDED');
  });

  it('lists persisted triage runs for an incident', async () => {
    const incidentId = await createIncident();
    const first = await runTriage(incidentId);
    const second = await runTriage(incidentId);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/triage`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body.map((run: { id: string }) => run.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it('applies a confirmed suggestion and recomputes priority deterministically', async () => {
    const incidentId = await createIncident();
    const triage = await runTriage(incidentId);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/triage/${triage.id}/confirm`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);

    expect(response.body.status).toBe('CONFIRMED');
    expect(response.body.incidentType).toBe('ACCIDENT');
    expect(response.body.priority).toBe('CRITICAL');
    expect(response.body.riskFactors.length).toBeGreaterThan(0);
  });

  it('forbids confirmation by a VIEWER', async () => {
    const incidentId = await createIncident();
    const triage = await runTriage(incidentId);

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/triage/${triage.id}/confirm`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('rejects a duplicate confirmation', async () => {
    const incidentId = await createIncident();
    const triage = await runTriage(incidentId);
    const confirmPath = `/api/v1/incidents/${incidentId}/triage/${triage.id}/confirm`;

    await request(app.getHttpServer())
      .post(confirmPath)
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(confirmPath)
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(409);
  });

  it('rejects an eligible triage suggestion without changing the incident', async () => {
    const incidentId = await createIncident();
    const triage = await runTriage(incidentId);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/triage/${triage.id}/reject`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ reason: 'Sugestão não corresponde ao relato.' })
      .expect(200);

    expect(response.body.status).toBe('REJECTED');

    const incidentResponse = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(incidentResponse.body.status).toBe('REPORTED');
    expect(incidentResponse.body.incidentType).toBeNull();

    const eventsResponse = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/events`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(
      eventsResponse.body.some(
        (event: { type: string; metadata?: { reason?: string } }) =>
          event.type === 'SUGGESTION_REJECTED' &&
          event.metadata?.reason === 'Sugestão não corresponde ao relato.',
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/triage/${triage.id}/reject`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({})
      .expect(409);
  });

  it('rejects a suggestion as a VIEWER', async () => {
    const incidentId = await createIncident();
    const triage = await runTriage(incidentId);

    await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/triage/${triage.id}/reject`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({})
      .expect(403);
  });

  it('rejects oversized request bodies', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ originalReport: 'x'.repeat(200_000) })
      .expect(413);
  });

  it('rejects invalid triage input via global validation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/triage')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ sourceText: '' })
      .expect(400);
  });

  describe('when the AI provider fails', () => {
    let failingApp: INestApplication;

    beforeAll(async () => {
      failingApp = await createApp(true);
    });

    afterAll(async () => {
      await failingApp.close();
    });

    it('persists a FAILED triage run without leaking provider internals', async () => {
      const response = await request(failingApp.getHttpServer())
        .post('/api/v1/triage')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ sourceText: ACCIDENT_REPORT })
        .expect(201);

      createdTriageRunIds.push(response.body.id);
      expect(response.body.status).toBe('FAILED');
      expect(response.body.errorMessage).toBe('provider error');
      expect(response.body.suggestedIncidentType).toBeNull();
    });
  });
});

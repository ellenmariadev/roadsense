import { BadRequestException, ConflictException } from '@nestjs/common';
import { Incident, IncidentEventType, TriageRun, TriageStatus, UserRole } from '@prisma/client';
import { LlmExecutorService, LlmExecutionResult } from '../ai/llm-executor.service';
import { LlmProviderError } from '../ai/llm-provider.interface';
import { PrismaService } from '../prisma/prisma.service';
import { TriageService } from './triage.service';

type ExecutorMock = { execute: jest.Mock };

function makeExecutor(): ExecutorMock {
  return { execute: jest.fn() };
}

function makeSuccessExecution(): LlmExecutionResult {
  return {
    extraction: {
      output: { incidentType: 'ACCIDENT', roadName: 'BR-116', confidence: 0.9 },
      provider: 'fake',
      model: 'fake-v1',
      promptTokens: 10,
      completionTokens: 5,
    },
    latencyMs: 12,
    attempts: 1,
  };
}

function createFakePrisma() {
  const triageRun = {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const incident = {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const incidentEvent = { create: jest.fn() };
  const user = { findUnique: jest.fn() };

  const tx = { triageRun, incident, incidentEvent, user };

  return {
    triageRun,
    incident,
    incidentEvent,
    user,
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
}

function pendingRun(overrides: Partial<TriageRun> = {}): TriageRun {
  return {
    id: 'run-1',
    sourceText: 'relato',
    status: TriageStatus.PENDING,
    provider: null,
    model: null,
    latencyMs: null,
    promptTokens: null,
    completionTokens: null,
    errorMessage: null,
    suggestedIncidentType: null,
    suggestedDescription: null,
    suggestedLocationText: null,
    suggestedRoadName: null,
    suggestedKilometerMarker: null,
    suggestedDirection: null,
    riskFactors: [],
    confidence: null,
    missingInformation: [],
    idempotencyKey: null,
    requestedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    incidentId: null,
    ...overrides,
  } as TriageRun;
}

function reportedIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'inc-1',
    originalReport: 'relato',
    incidentType: null,
    description: null,
    locationText: null,
    roadName: null,
    kilometerMarker: null,
    direction: null,
    priority: 'LOW',
    riskFactors: [],
    status: 'REPORTED',
    reportedAt: new Date(),
    resolvedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    ...overrides,
  } as Incident;
}

function setup(prisma = createFakePrisma(), executor = makeExecutor()) {
  const service = new TriageService(
    prisma as unknown as PrismaService,
    executor as unknown as LlmExecutorService,
  );
  return { service, prisma, executor };
}

describe('TriageService.create', () => {
  it('persists a SUCCEEDED run with the validated suggestion', async () => {
    const { service, prisma, executor } = setup();
    executor.execute.mockResolvedValue(makeSuccessExecution());
    prisma.triageRun.create.mockResolvedValue(pendingRun());
    prisma.triageRun.update.mockImplementation(async (args: { data: unknown }) => ({
      ...pendingRun(),
      ...(args.data as object),
    }));

    const result = await service.create({ sourceText: 'relato' });

    expect(executor.execute).toHaveBeenCalledWith('relato');
    expect(prisma.triageRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: TriageStatus.SUCCEEDED,
          provider: 'fake',
          model: 'fake-v1',
          suggestedIncidentType: 'ACCIDENT',
          suggestedRoadName: 'BR-116',
          latencyMs: 12,
        }),
      }),
    );
    expect(result.status).toBe(TriageStatus.SUCCEEDED);
  });

  it('records a TRIAGE_EXECUTED event when the run is linked to an incident', async () => {
    const { service, prisma, executor } = setup();
    executor.execute.mockResolvedValue(makeSuccessExecution());
    prisma.incident.findUnique.mockResolvedValue(reportedIncident({ id: 'inc-1' }));
    prisma.triageRun.create.mockResolvedValue(pendingRun({ incidentId: 'inc-1' }));
    prisma.triageRun.update.mockImplementation(async (args: { data: unknown }) => ({
      ...pendingRun({ incidentId: 'inc-1' }),
      ...(args.data as object),
    }));

    await service.create({ sourceText: 'relato', incidentId: 'inc-1' });

    expect(prisma.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: 'inc-1',
          type: IncidentEventType.TRIAGE_EXECUTED,
        }),
      }),
    );
  });

  it('marks the run FAILED on a provider failure and records TRIAGE_FAILED', async () => {
    const { service, prisma, executor } = setup();
    executor.execute.mockRejectedValue(new LlmProviderError('boom'));
    prisma.incident.findUnique.mockResolvedValue(reportedIncident({ id: 'inc-1' }));
    prisma.triageRun.create.mockResolvedValue(pendingRun({ incidentId: 'inc-1' }));
    prisma.triageRun.update.mockImplementation(async (args: { data: unknown }) => ({
      ...pendingRun({ incidentId: 'inc-1' }),
      ...(args.data as object),
    }));

    const result = await service.create({ sourceText: 'relato', incidentId: 'inc-1' });

    expect(result.status).toBe(TriageStatus.FAILED);
    expect(result.errorMessage).toBe('provider error');
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: IncidentEventType.TRIAGE_FAILED }),
      }),
    );
  });

  it('rejects malformed output (non-object) as a failed run', async () => {
    const { service, prisma, executor } = setup();
    executor.execute.mockResolvedValue({
      extraction: { output: 'not-json', provider: 'fake', model: 'fake-v1' },
      latencyMs: 1,
      attempts: 1,
    });
    prisma.triageRun.create.mockResolvedValue(pendingRun());
    prisma.triageRun.update.mockImplementation(async (args: { data: unknown }) => ({
      ...pendingRun(),
      ...(args.data as object),
    }));

    const result = await service.create({ sourceText: 'relato' });

    expect(result.status).toBe(TriageStatus.FAILED);
    expect(result.errorMessage).toContain('schema-invalid');
  });

  it('preserves missing fields as null (succeeds with empty output)', async () => {
    const { service, prisma, executor } = setup();
    executor.execute.mockResolvedValue({
      extraction: { output: {}, provider: 'fake', model: 'fake-v1' },
      latencyMs: 1,
      attempts: 1,
    });
    prisma.triageRun.create.mockResolvedValue(pendingRun());
    prisma.triageRun.update.mockImplementation(async (args: { data: unknown }) => ({
      ...pendingRun(),
      ...(args.data as object),
    }));

    const result = await service.create({ sourceText: 'relato' });

    expect(result.status).toBe(TriageStatus.SUCCEEDED);
    expect(prisma.triageRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          suggestedIncidentType: null,
          suggestedRoadName: null,
        }),
      }),
    );
  });

  it('rejects unsupported claims (unknown fields)', async () => {
    const { service, prisma, executor } = setup();
    executor.execute.mockResolvedValue({
      extraction: {
        output: { incidentType: 'ACCIDENT', sql: 'DROP TABLE incidents;' },
        provider: 'fake',
        model: 'fake-v1',
      },
      latencyMs: 1,
      attempts: 1,
    });
    prisma.triageRun.create.mockResolvedValue(pendingRun());
    prisma.triageRun.update.mockImplementation(async (args: { data: unknown }) => ({
      ...pendingRun(),
      ...(args.data as object),
    }));

    const result = await service.create({ sourceText: 'relato' });

    expect(result.status).toBe(TriageStatus.FAILED);
    expect(result.errorMessage).toContain('schema-invalid');
  });

  it('rejects idempotency key reuse with a different payload', async () => {
    const { service, prisma, executor } = setup();
    prisma.triageRun.findUnique.mockResolvedValue(
      pendingRun({ idempotencyKey: 'key-1', sourceText: 'original' }),
    );

    await expect(
      service.create({ sourceText: 'different', idempotencyKey: 'key-1' }),
    ).rejects.toThrow(ConflictException);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('rejects a triage run linked to a missing incident', async () => {
    const { service, prisma, executor } = setup();
    prisma.triageRun.findUnique.mockResolvedValue(null);
    prisma.incident.findUnique.mockResolvedValue(null);

    await expect(service.create({ sourceText: 'relato', incidentId: 'missing' })).rejects.toThrow(
      'Incident not found',
    );
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('returns the existing run for a duplicate idempotency key without executing the LLM', async () => {
    const { service, prisma, executor } = setup();
    const existing = pendingRun({ idempotencyKey: 'key-1', status: TriageStatus.SUCCEEDED });
    prisma.triageRun.findUnique.mockResolvedValue(existing);

    const result = await service.create({ sourceText: 'relato', idempotencyKey: 'key-1' });

    expect(result.id).toBe(existing.id);
    expect(executor.execute).not.toHaveBeenCalled();
    expect(prisma.triageRun.create).not.toHaveBeenCalled();
  });
});

describe('TriageService.confirm', () => {
  it('applies the suggestion, recomputes priority deterministically, and audits the change', async () => {
    const { service, prisma } = setup();
    prisma.incident.findUnique.mockResolvedValue(reportedIncident());
    prisma.triageRun.findUnique.mockResolvedValue(
      pendingRun({
        incidentId: 'inc-1',
        status: TriageStatus.SUCCEEDED,
        suggestedIncidentType: 'VEHICLE_BREAKDOWN',
        riskFactors: ['vítimas'],
      }),
    );
    prisma.triageRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.incident.updateMany.mockResolvedValue({ count: 1 });
    prisma.incident.findUniqueOrThrow.mockResolvedValue(
      reportedIncident({
        status: 'CONFIRMED',
        priority: 'CRITICAL',
        incidentType: 'VEHICLE_BREAKDOWN',
      }),
    );

    const result = await service.confirm('inc-1', 'run-1', {
      id: 'actor-1',
      email: 'operator@example.com',
      name: null,
      role: UserRole.OPERATOR,
    });

    expect(prisma.incident.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CONFIRMED', priority: 'CRITICAL' }),
      }),
    );
    expect(prisma.triageRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: TriageStatus.CONFIRMED } }),
    );
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: IncidentEventType.SUGGESTION_CONFIRMED }),
      }),
    );
    expect(result.priority).toBe('CRITICAL');
  });

  it('rejects confirmation when another request already claimed the suggestion', async () => {
    const { service, prisma } = setup();
    prisma.incident.findUnique.mockResolvedValue(reportedIncident());
    prisma.triageRun.findUnique.mockResolvedValue(
      pendingRun({ incidentId: 'inc-1', status: TriageStatus.SUCCEEDED }),
    );
    prisma.triageRun.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.confirm('inc-1', 'run-1', {
        id: 'actor-1',
        email: 'operator@example.com',
        name: null,
        role: UserRole.OPERATOR,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.incident.updateMany).not.toHaveBeenCalled();
  });

  it('rejects confirming a non-succeeded triage run', async () => {
    const { service, prisma } = setup();
    prisma.incident.findUnique.mockResolvedValue(reportedIncident());
    prisma.triageRun.findUnique.mockResolvedValue(
      pendingRun({ incidentId: 'inc-1', status: TriageStatus.FAILED }),
    );

    await expect(
      service.confirm('inc-1', 'run-1', {
        id: 'actor-1',
        email: 'operator@example.com',
        name: null,
        role: UserRole.OPERATOR,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects confirming a triage run that belongs to another incident', async () => {
    const { service, prisma } = setup();
    prisma.incident.findUnique.mockResolvedValue(reportedIncident());
    prisma.triageRun.findUnique.mockResolvedValue(
      pendingRun({ incidentId: 'other-incident', status: TriageStatus.SUCCEEDED }),
    );

    await expect(
      service.confirm('inc-1', 'run-1', {
        id: 'actor-1',
        email: 'operator@example.com',
        name: null,
        role: UserRole.OPERATOR,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects confirming against an incident not awaiting review', async () => {
    const { service, prisma } = setup();
    prisma.incident.findUnique.mockResolvedValue(reportedIncident({ status: 'RESOLVED' }));
    prisma.triageRun.findUnique.mockResolvedValue(
      pendingRun({ incidentId: 'inc-1', status: TriageStatus.SUCCEEDED }),
    );

    await expect(
      service.confirm('inc-1', 'run-1', {
        id: 'actor-1',
        email: 'operator@example.com',
        name: null,
        role: UserRole.OPERATOR,
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('TriageService.reject', () => {
  it('marks a succeeded suggestion as rejected and records the decision without changing the incident', async () => {
    const { service, prisma } = setup();
    prisma.incident.findUnique.mockResolvedValue(reportedIncident());
    prisma.triageRun.findUnique.mockResolvedValue(
      pendingRun({ incidentId: 'inc-1', status: TriageStatus.SUCCEEDED }),
    );
    prisma.triageRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.triageRun.findUniqueOrThrow.mockResolvedValue(
      pendingRun({ incidentId: 'inc-1', status: TriageStatus.REJECTED }),
    );

    const result = await service.reject(
      'inc-1',
      'run-1',
      { id: 'actor-1', email: 'operator@example.com', name: null, role: UserRole.OPERATOR },
      { reason: 'Sugestão incorreta' },
    );

    expect(result.status).toBe(TriageStatus.REJECTED);
    expect(prisma.triageRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: TriageStatus.SUCCEEDED },
      data: { status: TriageStatus.REJECTED },
    });
    expect(prisma.incident.updateMany).not.toHaveBeenCalled();
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: 'inc-1',
          type: IncidentEventType.SUGGESTION_REJECTED,
          actorId: 'actor-1',
        }),
      }),
    );
  });

  it('rejects the decision when another request already claimed the suggestion', async () => {
    const { service, prisma } = setup();
    prisma.incident.findUnique.mockResolvedValue(reportedIncident());
    prisma.triageRun.findUnique.mockResolvedValue(
      pendingRun({ incidentId: 'inc-1', status: TriageStatus.SUCCEEDED }),
    );
    prisma.triageRun.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.reject(
        'inc-1',
        'run-1',
        { id: 'actor-1', email: 'operator@example.com', name: null, role: UserRole.OPERATOR },
        {},
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.incidentEvent.create).not.toHaveBeenCalled();
  });
});

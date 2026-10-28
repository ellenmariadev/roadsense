import {
  IncidentEventType,
  IncidentStatus,
  IncidentType,
  Priority,
  PrismaClient,
  TriageStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requiredSeedValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required to seed local users. Set it only in your untracked .env file.`,
    );
  }
  return value;
}

const USERS = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com',
    name: 'Alice Admin',
    role: UserRole.ADMIN,
    password: requiredSeedValue('SEED_ADMIN_PASSWORD'),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: process.env.SEED_OPERATOR_EMAIL ?? 'operator@example.com',
    name: 'Bruno Operator',
    role: UserRole.OPERATOR,
    password: requiredSeedValue('SEED_OPERATOR_PASSWORD'),
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    email: process.env.SEED_VIEWER_EMAIL ?? 'viewer@example.com',
    name: 'Carla Viewer',
    role: UserRole.VIEWER,
    password: requiredSeedValue('SEED_VIEWER_PASSWORD'),
  },
];

const INCIDENTS = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    originalReport:
      'Colisão entre dois veículos de passeio na BR-116, km 245, sentido sul. Duas faixas bloqueadas, há vítimas.',
    incidentType: IncidentType.ACCIDENT,
    description: 'Colisão entre dois veículos de passeio',
    locationText: 'BR-116, km 245',
    roadName: 'BR-116',
    kilometerMarker: '245',
    direction: 'sul',
    priority: Priority.HIGH,
    status: IncidentStatus.CONFIRMED,
    reportedAt: '2025-11-02T08:15:00.000Z',
    createdById: USERS[1].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    originalReport:
      'Caminhão parado no acostamento da SP-330 por falha mecânica, próximo ao km 87.',
    incidentType: IncidentType.VEHICLE_BREAKDOWN,
    description: 'Caminhão com falha mecânica no acostamento',
    locationText: 'SP-330, próximo ao km 87',
    roadName: 'SP-330',
    kilometerMarker: '87',
    direction: null,
    priority: Priority.MEDIUM,
    status: IncidentStatus.UNDER_REVIEW,
    reportedAt: '2025-11-03T10:40:00.000Z',
    createdById: USERS[1].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    originalReport:
      'Alagamento severo na altura do km 12 da rodovia, pista totalmente coberta por água.',
    incidentType: IncidentType.FLOODING,
    description: 'Alagamento cobrindo toda a pista',
    locationText: 'km 12',
    roadName: null,
    kilometerMarker: '12',
    direction: null,
    priority: Priority.CRITICAL,
    status: IncidentStatus.IN_PROGRESS,
    reportedAt: '2025-11-04T06:05:00.000Z',
    createdById: USERS[1].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    originalReport: 'Árvore caída bloqueando parcialmente a pista no km 33, sentido norte.',
    incidentType: IncidentType.ROAD_OBSTRUCTION,
    description: 'Árvore caída bloqueando parte da pista',
    locationText: 'km 33',
    roadName: null,
    kilometerMarker: '33',
    direction: 'norte',
    priority: Priority.LOW,
    status: IncidentStatus.RESOLVED,
    reportedAt: '2025-11-01T14:30:00.000Z',
    resolvedAt: '2025-11-01T16:45:00.000Z',
    createdById: USERS[1].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000105',
    originalReport: 'Buraco grande no asfalto causando danos a veículos na altura do km 99.',
    incidentType: IncidentType.INFRASTRUCTURE_DAMAGE,
    description: 'Buraco no asfalto no km 99',
    locationText: 'km 99',
    roadName: null,
    kilometerMarker: '99',
    direction: null,
    priority: Priority.MEDIUM,
    status: IncidentStatus.CANCELLED,
    reportedAt: '2025-11-05T09:00:00.000Z',
    cancelledAt: '2025-11-05T09:20:00.000Z',
    createdById: USERS[1].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000106',
    originalReport: 'Algo estranho na pista, não consegui identificar o que era.',
    incidentType: null,
    description: null,
    locationText: null,
    roadName: null,
    kilometerMarker: null,
    direction: null,
    priority: Priority.LOW,
    status: IncidentStatus.REPORTED,
    reportedAt: '2025-11-06T11:20:00.000Z',
    createdById: USERS[1].id,
  },
];

const EVENTS = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    incidentId: INCIDENTS[0].id,
    type: IncidentEventType.INCIDENT_CREATED,
    actorId: USERS[1].id,
    metadata: { source: 'operator' },
    createdAt: '2025-11-02T08:15:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    incidentId: INCIDENTS[0].id,
    type: IncidentEventType.PRIORITY_CHANGED,
    actorId: USERS[0].id,
    metadata: { from: 'LOW', to: 'HIGH' },
    createdAt: '2025-11-02T08:20:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000303',
    incidentId: INCIDENTS[0].id,
    type: IncidentEventType.STATUS_TRANSITION,
    actorId: USERS[1].id,
    metadata: { from: 'REPORTED', to: 'CONFIRMED' },
    createdAt: '2025-11-02T08:25:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000304',
    incidentId: INCIDENTS[1].id,
    type: IncidentEventType.INCIDENT_CREATED,
    actorId: USERS[1].id,
    metadata: { source: 'operator' },
    createdAt: '2025-11-03T10:40:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000305',
    incidentId: INCIDENTS[2].id,
    type: IncidentEventType.INCIDENT_CREATED,
    actorId: USERS[1].id,
    metadata: { source: 'operator' },
    createdAt: '2025-11-04T06:05:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000306',
    incidentId: INCIDENTS[3].id,
    type: IncidentEventType.INCIDENT_CREATED,
    actorId: USERS[1].id,
    metadata: { source: 'operator' },
    createdAt: '2025-11-01T14:30:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000307',
    incidentId: INCIDENTS[3].id,
    type: IncidentEventType.RESOLVED,
    actorId: USERS[1].id,
    metadata: { resolution: 'árvore removida' },
    createdAt: '2025-11-01T16:45:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000308',
    incidentId: INCIDENTS[4].id,
    type: IncidentEventType.INCIDENT_CREATED,
    actorId: USERS[1].id,
    metadata: { source: 'operator' },
    createdAt: '2025-11-05T09:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000309',
    incidentId: INCIDENTS[4].id,
    type: IncidentEventType.CANCELLED,
    actorId: USERS[1].id,
    metadata: { reason: 'denúncia duplicada' },
    createdAt: '2025-11-05T09:20:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000310',
    incidentId: INCIDENTS[5].id,
    type: IncidentEventType.INCIDENT_CREATED,
    actorId: USERS[1].id,
    metadata: { source: 'operator' },
    createdAt: '2025-11-06T11:20:00.000Z',
  },
];

const TRIAGE_RUNS = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    incidentId: INCIDENTS[0].id,
    sourceText: INCIDENTS[0].originalReport,
    status: TriageStatus.SUCCEEDED,
    provider: 'mock',
    model: 'mock-triage-v1',
    latencyMs: 120,
    promptTokens: 350,
    completionTokens: 80,
    suggestedIncidentType: IncidentType.ACCIDENT,
    suggestedDescription: 'Colisão entre dois veículos de passeio',
    suggestedLocationText: 'BR-116, km 245',
    suggestedRoadName: 'BR-116',
    suggestedKilometerMarker: '245',
    suggestedDirection: 'sul',
    riskFactors: ['bloqueio de faixa', 'possíveis vítimas'],
    confidence: 0.92,
    missingInformation: [],
    idempotencyKey: 'seed-triage-101',
    requestedAt: '2025-11-02T08:16:00.000Z',
    completedAt: '2025-11-02T08:16:01.200Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    incidentId: INCIDENTS[1].id,
    sourceText: INCIDENTS[1].originalReport,
    status: TriageStatus.SUCCEEDED,
    provider: 'mock',
    model: 'mock-triage-v1',
    latencyMs: 95,
    promptTokens: 310,
    completionTokens: 60,
    suggestedIncidentType: IncidentType.VEHICLE_BREAKDOWN,
    suggestedDescription: 'Caminhão com falha mecânica no acostamento',
    suggestedLocationText: 'SP-330, km 87',
    suggestedRoadName: 'SP-330',
    suggestedKilometerMarker: '87',
    suggestedDirection: null,
    riskFactors: [],
    confidence: 0.68,
    missingInformation: ['localização exata do veículo'],
    idempotencyKey: 'seed-triage-102',
    requestedAt: '2025-11-03T10:42:00.000Z',
    completedAt: '2025-11-03T10:42:00.950Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    incidentId: INCIDENTS[2].id,
    sourceText: INCIDENTS[2].originalReport,
    status: TriageStatus.CONFIRMED,
    provider: 'mock',
    model: 'mock-triage-v1',
    latencyMs: 140,
    promptTokens: 330,
    completionTokens: 70,
    suggestedIncidentType: IncidentType.FLOODING,
    suggestedDescription: 'Alagamento cobrindo toda a pista',
    suggestedLocationText: 'km 12',
    suggestedRoadName: null,
    suggestedKilometerMarker: '12',
    suggestedDirection: null,
    riskFactors: ['pista intransitável'],
    confidence: 0.95,
    missingInformation: [],
    idempotencyKey: 'seed-triage-103',
    requestedAt: '2025-11-04T06:07:00.000Z',
    completedAt: '2025-11-04T06:07:01.400Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000204',
    incidentId: INCIDENTS[5].id,
    sourceText: INCIDENTS[5].originalReport,
    status: TriageStatus.FAILED,
    provider: 'mock',
    model: 'mock-triage-v1',
    latencyMs: null,
    promptTokens: null,
    completionTokens: null,
    suggestedIncidentType: null,
    suggestedDescription: null,
    suggestedLocationText: null,
    suggestedRoadName: null,
    suggestedKilometerMarker: null,
    suggestedDirection: null,
    riskFactors: [],
    confidence: null,
    missingInformation: [],
    errorMessage: 'provider timeout',
    idempotencyKey: 'seed-triage-106',
    requestedAt: '2025-11-06T11:25:00.000Z',
    completedAt: '2025-11-06T11:25:05.000Z',
  },
];

const ARTICLES = [
  {
    id: '00000000-0000-4000-8000-000000000401',
    title: 'Procedimento: acidente com vítimas',
    content:
      'Acione imediatamente o resgate. Isole a área, sinalize a via e não mova as vítimas. Registre o boletim de ocorrência com o máximo de detalhes possível.',
    tags: ['acidente', 'vítimas', 'emergência'],
    createdById: USERS[0].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000402',
    title: 'Procedimento: alagamento na pista',
    content:
      'Sinalize o trecho e interrompa o tráfego se necessário. Verifique pontos de drenagem e monitore o nível da água antes de liberar a via.',
    tags: ['alagamento', 'pista', 'segurança'],
    createdById: USERS[0].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000403',
    title: 'Procedimento: obstrução de rodovia',
    content:
      'Identifique o tipo de obstrução e o risco envolvido. Solicite equipe de remoção e mantenha o tráfego em velocidade reduzida enquanto a via não estiver livre.',
    tags: ['obstrução', 'remoção', 'tráfego'],
    createdById: USERS[0].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000404',
    title: 'Procedimento: veículo quebrado no acostamento',
    content:
      'Sinalize o veículo com triângulo e mantenha a distância de segurança. Solicite guincho e oriente o condutor a permanecer fora da pista.',
    tags: ['veículo', 'falha mecânica', 'acostamento'],
    createdById: USERS[0].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000405',
    title: 'Procedimento: dano em pavimento e buracos',
    content:
      'Registre a extensão do dano e sinalize o trecho. Comunique a equipe de manutenção e priorize reparos que ofereçam risco imediato ao tráfego.',
    tags: ['pavimento', 'buraco', 'infraestrutura'],
    createdById: USERS[0].id,
  },
  {
    id: '00000000-0000-4000-8000-000000000406',
    title: 'Procedimento: capotamento com vítimas',
    content:
      'Isole a área, acione resgate e corpo de bombeiros. Não mova os ocupantes até a chegada do socorro especializado e preserve o local do acidente.',
    tags: ['capotamento', 'vítimas', 'emergência'],
    createdById: USERS[0].id,
  },
];

async function main(): Promise<void> {
  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
  }

  for (const incident of INCIDENTS) {
    await prisma.incident.upsert({
      where: { id: incident.id },
      update: {
        originalReport: incident.originalReport,
        incidentType: incident.incidentType,
        description: incident.description,
        locationText: incident.locationText,
        roadName: incident.roadName,
        kilometerMarker: incident.kilometerMarker,
        direction: incident.direction,
        priority: incident.priority,
        status: incident.status,
        reportedAt: incident.reportedAt,
        resolvedAt: incident.resolvedAt ?? null,
        cancelledAt: incident.cancelledAt ?? null,
        createdById: incident.createdById,
      },
      create: {
        id: incident.id,
        originalReport: incident.originalReport,
        incidentType: incident.incidentType,
        description: incident.description,
        locationText: incident.locationText,
        roadName: incident.roadName,
        kilometerMarker: incident.kilometerMarker,
        direction: incident.direction,
        priority: incident.priority,
        status: incident.status,
        reportedAt: incident.reportedAt,
        resolvedAt: incident.resolvedAt ?? null,
        cancelledAt: incident.cancelledAt ?? null,
        createdById: incident.createdById,
      },
    });
  }

  for (const event of EVENTS) {
    await prisma.incidentEvent.upsert({
      where: { id: event.id },
      update: {
        type: event.type,
        metadata: event.metadata ?? undefined,
        incidentId: event.incidentId,
        actorId: event.actorId,
        createdAt: event.createdAt,
      },
      create: {
        id: event.id,
        type: event.type,
        metadata: event.metadata ?? undefined,
        incidentId: event.incidentId,
        actorId: event.actorId,
        createdAt: event.createdAt,
      },
    });
  }

  for (const run of TRIAGE_RUNS) {
    await prisma.triageRun.upsert({
      where: { id: run.id },
      update: {
        sourceText: run.sourceText,
        status: run.status,
        provider: run.provider,
        model: run.model,
        latencyMs: run.latencyMs,
        promptTokens: run.promptTokens,
        completionTokens: run.completionTokens,
        errorMessage: run.errorMessage,
        suggestedIncidentType: run.suggestedIncidentType,
        suggestedDescription: run.suggestedDescription,
        suggestedLocationText: run.suggestedLocationText,
        suggestedRoadName: run.suggestedRoadName,
        suggestedKilometerMarker: run.suggestedKilometerMarker,
        suggestedDirection: run.suggestedDirection,
        riskFactors: run.riskFactors,
        confidence: run.confidence,
        missingInformation: run.missingInformation,
        idempotencyKey: run.idempotencyKey,
        requestedAt: run.requestedAt,
        completedAt: run.completedAt,
        incidentId: run.incidentId,
      },
      create: {
        id: run.id,
        sourceText: run.sourceText,
        status: run.status,
        provider: run.provider,
        model: run.model,
        latencyMs: run.latencyMs,
        promptTokens: run.promptTokens,
        completionTokens: run.completionTokens,
        errorMessage: run.errorMessage,
        suggestedIncidentType: run.suggestedIncidentType,
        suggestedDescription: run.suggestedDescription,
        suggestedLocationText: run.suggestedLocationText,
        suggestedRoadName: run.suggestedRoadName,
        suggestedKilometerMarker: run.suggestedKilometerMarker,
        suggestedDirection: run.suggestedDirection,
        riskFactors: run.riskFactors,
        confidence: run.confidence,
        missingInformation: run.missingInformation,
        idempotencyKey: run.idempotencyKey,
        requestedAt: run.requestedAt,
        completedAt: run.completedAt,
        incidentId: run.incidentId,
      },
    });
  }

  for (const article of ARTICLES) {
    await prisma.knowledgeArticle.upsert({
      where: { id: article.id },
      update: {
        title: article.title,
        content: article.content,
        tags: article.tags,
        createdById: article.createdById,
      },
      create: {
        id: article.id,
        title: article.title,
        content: article.content,
        tags: article.tags,
        createdById: article.createdById,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    incidents: await prisma.incident.count(),
    incidentEvents: await prisma.incidentEvent.count(),
    triageRuns: await prisma.triageRun.count(),
    knowledgeArticles: await prisma.knowledgeArticle.count(),
  };

  console.log('Seed completed:', JSON.stringify(counts));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

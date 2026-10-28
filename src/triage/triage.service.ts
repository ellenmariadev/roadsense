import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Incident,
  IncidentEventType,
  IncidentStatus,
  Prisma,
  TriageRun,
  TriageStatus,
} from '@prisma/client';
import { TimeoutError } from '../common/utils/with-timeout';
import { LlmExecutorService, LlmExecutionResult } from '../ai/llm-executor.service';
import { LlmOutputValidationError, LlmProviderError } from '../ai/llm-provider.interface';
import { TriageOutputDto, validateTriageOutput } from '../ai/triage-output.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTriageDto } from './dto/create-triage.dto';
import { RejectTriageDto } from './dto/reject-triage.dto';
import { isTransitionAllowed } from '../incidents/incident-state-machine';
import { calculatePriority } from './priority.rules';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: LlmExecutorService,
  ) {}

  async create(dto: CreateTriageDto): Promise<TriageRun> {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.triageRun.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        this.assertIdempotentMatch(existing, dto);
        return existing;
      }
    }

    if (dto.incidentId) {
      const incident = await this.prisma.incident.findUnique({ where: { id: dto.incidentId } });
      if (!incident) {
        throw new NotFoundException('Incident not found');
      }
    }

    let run: TriageRun;
    try {
      run = await this.prisma.triageRun.create({
        data: {
          sourceText: dto.sourceText,
          status: TriageStatus.PENDING,
          incidentId: dto.incidentId ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
        },
      });
    } catch (error) {
      if (
        dto.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.triageRun.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          this.assertIdempotentMatch(existing, dto);
          return existing;
        }
      }
      throw error;
    }

    let execution: LlmExecutionResult;
    try {
      execution = await this.executor.execute(dto.sourceText);
    } catch (error) {
      return this.markFailed(run, error);
    }

    let suggestion: TriageOutputDto;
    try {
      suggestion = validateTriageOutput(execution.extraction.output);
    } catch (error) {
      return this.markFailed(run, error);
    }

    const updated = await this.prisma.triageRun.update({
      where: { id: run.id },
      data: {
        status: TriageStatus.SUCCEEDED,
        provider: execution.extraction.provider,
        model: execution.extraction.model,
        latencyMs: execution.latencyMs,
        promptTokens: execution.extraction.promptTokens ?? null,
        completionTokens: execution.extraction.completionTokens ?? null,
        suggestedIncidentType: suggestion.incidentType ?? null,
        suggestedDescription: suggestion.description ?? null,
        suggestedLocationText: suggestion.locationText ?? null,
        suggestedRoadName: suggestion.roadName ?? null,
        suggestedKilometerMarker: suggestion.kilometerMarker ?? null,
        suggestedDirection: suggestion.direction ?? null,
        riskFactors: suggestion.riskFactors ?? [],
        confidence: suggestion.confidence ?? null,
        missingInformation: suggestion.missingInformation ?? [],
        completedAt: new Date(),
      },
    });

    await this.recordEvent(run.incidentId, IncidentEventType.TRIAGE_EXECUTED, null, {
      triageRunId: run.id,
      provider: execution.extraction.provider,
      model: execution.extraction.model,
    });

    return updated;
  }

  private assertIdempotentMatch(existing: TriageRun, dto: CreateTriageDto): void {
    if (
      existing.sourceText !== dto.sourceText ||
      existing.incidentId !== (dto.incidentId ?? null)
    ) {
      throw new ConflictException('Idempotency key was already used with a different payload');
    }
  }

  async findOne(id: string): Promise<TriageRun> {
    const run = await this.prisma.triageRun.findUnique({ where: { id } });
    if (!run) {
      throw new NotFoundException('Triage run not found');
    }
    return run;
  }

  async findByIncident(incidentId: string): Promise<TriageRun[]> {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return this.prisma.triageRun.findMany({
      where: { incidentId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async confirm(incidentId: string, triageId: string, actor: AuthenticatedUser): Promise<Incident> {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const triageRun = await this.prisma.triageRun.findUnique({ where: { id: triageId } });
    if (!triageRun) {
      throw new NotFoundException('Triage run not found');
    }

    if (triageRun.incidentId !== incidentId) {
      throw new BadRequestException('Triage run does not belong to this incident');
    }

    if (triageRun.status !== TriageStatus.SUCCEEDED) {
      throw new ConflictException('Only succeeded triage runs can be confirmed');
    }

    if (!isTransitionAllowed(incident.status, IncidentStatus.CONFIRMED)) {
      throw new ConflictException(
        `Incident in status ${incident.status} cannot have a triage confirmed`,
      );
    }

    const priority = calculatePriority(triageRun.suggestedIncidentType, triageRun.riskFactors);
    const changedFields = confirmedFieldsChanged(incident, triageRun);

    return this.prisma.$transaction(async (tx) => {
      const triageClaim = await tx.triageRun.updateMany({
        where: { id: triageId, status: TriageStatus.SUCCEEDED },
        data: { status: TriageStatus.CONFIRMED },
      });
      if (triageClaim.count === 0) {
        throw new ConflictException('Triage suggestion is no longer eligible for confirmation');
      }

      const incidentUpdate = await tx.incident.updateMany({
        where: { id: incidentId, status: incident.status },
        data: {
          incidentType: triageRun.suggestedIncidentType,
          description: triageRun.suggestedDescription,
          locationText: triageRun.suggestedLocationText,
          roadName: triageRun.suggestedRoadName,
          kilometerMarker: triageRun.suggestedKilometerMarker,
          direction: triageRun.suggestedDirection,
          riskFactors: triageRun.riskFactors,
          priority,
          status: IncidentStatus.CONFIRMED,
        },
      });
      if (incidentUpdate.count === 0) {
        throw new ConflictException('Incident status changed during confirmation; retry');
      }

      const updatedIncident = await tx.incident.findUniqueOrThrow({ where: { id: incidentId } });

      await tx.incidentEvent.create({
        data: {
          incidentId,
          type: IncidentEventType.SUGGESTION_CONFIRMED,
          actorId: actor.id,
          metadata: { triageRunId: triageId, priority },
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId,
          type: IncidentEventType.STATUS_TRANSITION,
          actorId: actor.id,
          metadata: { from: incident.status, to: IncidentStatus.CONFIRMED },
        },
      });

      if (changedFields.length > 0) {
        await tx.incidentEvent.create({
          data: {
            incidentId,
            type: IncidentEventType.ATTRIBUTE_CHANGED,
            actorId: actor.id,
            metadata: {
              changedFields,
              before: pickIncidentAttributes(incident),
              after: pickTriageAttributes(triageRun),
            },
          },
        });
      }

      if (incident.priority !== priority) {
        await tx.incidentEvent.create({
          data: {
            incidentId,
            type: IncidentEventType.PRIORITY_CHANGED,
            actorId: actor.id,
            metadata: { from: incident.priority, to: priority },
          },
        });
      }

      return updatedIncident;
    });
  }

  async reject(
    incidentId: string,
    triageId: string,
    actor: AuthenticatedUser,
    dto: RejectTriageDto,
  ): Promise<TriageRun> {
    const incident = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const triageRun = await this.prisma.triageRun.findUnique({ where: { id: triageId } });
    if (!triageRun) {
      throw new NotFoundException('Triage run not found');
    }

    if (triageRun.incidentId !== incidentId) {
      throw new BadRequestException('Triage run does not belong to this incident');
    }

    if (triageRun.status !== TriageStatus.SUCCEEDED) {
      throw new ConflictException('Only succeeded triage runs can be rejected');
    }

    return this.prisma.$transaction(async (tx) => {
      const rejection = await tx.triageRun.updateMany({
        where: { id: triageId, status: TriageStatus.SUCCEEDED },
        data: { status: TriageStatus.REJECTED },
      });
      if (rejection.count === 0) {
        throw new ConflictException('Triage suggestion is no longer eligible for rejection');
      }

      const updated = await tx.triageRun.findUniqueOrThrow({ where: { id: triageId } });

      await tx.incidentEvent.create({
        data: {
          incidentId,
          type: IncidentEventType.SUGGESTION_REJECTED,
          actorId: actor.id,
          metadata: {
            triageRunId: triageId,
            ...(dto.reason ? { reason: dto.reason } : {}),
          },
        },
      });

      return updated;
    });
  }

  private async markFailed(run: TriageRun, error: unknown): Promise<TriageRun> {
    const message = toSafeErrorMessage(error);
    this.logger.warn(`Triage run ${run.id} failed: ${message}`);

    const updated = await this.prisma.triageRun.update({
      where: { id: run.id },
      data: {
        status: TriageStatus.FAILED,
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    await this.recordEvent(run.incidentId, IncidentEventType.TRIAGE_FAILED, null, {
      triageRunId: run.id,
      reason: message,
    });

    return updated;
  }

  private async recordEvent(
    incidentId: string | null,
    type: IncidentEventType,
    actorId: string | null,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    if (!incidentId) {
      return;
    }
    await this.prisma.incidentEvent.create({
      data: { incidentId, type, actorId, metadata },
    });
  }
}

function toSafeErrorMessage(error: unknown): string {
  if (error instanceof TimeoutError) return 'timeout';
  if (error instanceof LlmOutputValidationError) return `schema-invalid: ${error.message}`;
  if (error instanceof LlmProviderError) return 'provider error';
  return 'provider error';
}

const CONFIRMABLE_FIELDS = [
  'incidentType',
  'description',
  'locationText',
  'roadName',
  'kilometerMarker',
  'direction',
  'riskFactors',
] as const;

type ConfirmableField = (typeof CONFIRMABLE_FIELDS)[number];

function pickIncidentAttributes(incident: Incident): Pick<Incident, ConfirmableField> {
  return Object.fromEntries(CONFIRMABLE_FIELDS.map((field) => [field, incident[field]])) as Pick<
    Incident,
    ConfirmableField
  >;
}

function pickTriageAttributes(run: TriageRun): Record<ConfirmableField, string | string[] | null> {
  return {
    incidentType: run.suggestedIncidentType,
    description: run.suggestedDescription,
    locationText: run.suggestedLocationText,
    roadName: run.suggestedRoadName,
    kilometerMarker: run.suggestedKilometerMarker,
    direction: run.suggestedDirection,
    riskFactors: run.riskFactors,
  };
}

function confirmedFieldsChanged(incident: Incident, run: TriageRun): ConfirmableField[] {
  const after = pickTriageAttributes(run);
  return CONFIRMABLE_FIELDS.filter(
    (field) => JSON.stringify(incident[field]) !== JSON.stringify(after[field]),
  );
}

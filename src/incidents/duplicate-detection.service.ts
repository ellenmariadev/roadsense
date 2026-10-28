import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DuplicateStatus, Incident, IncidentDuplicate, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  DuplicateCandidateDto,
  DuplicateCandidatesResponseDto,
  DuplicateSignalsDto,
  ResolvedDuplicateDto,
} from './dto/duplicate-response.dto';
import { evaluateDuplicate } from './duplicate-detection';

const CANDIDATE_POOL_LIMIT = 100;

@Injectable()
export class DuplicateDetectionService {
  constructor(private readonly prisma: PrismaService) {}

  async findCandidates(incidentId: string): Promise<DuplicateCandidatesResponseDto> {
    const target = await this.prisma.incident.findUnique({ where: { id: incidentId } });
    if (!target) {
      throw new NotFoundException('Incident not found');
    }

    const resolved = await this.prisma.incidentDuplicate.findMany({
      where: { OR: [{ incidentId }, { duplicateIncidentId: incidentId }] },
      include: { incident: true, duplicate: true },
    });

    const resolvedKeys = new Set(
      resolved.map((record) => this.pairKey(record.incidentId, record.duplicateIncidentId)),
    );

    const confirmed: ResolvedDuplicateDto[] = [];
    const rejected: ResolvedDuplicateDto[] = [];
    for (const record of resolved) {
      const dto = this.toResolvedDto(incidentId, record);
      if (record.status === DuplicateStatus.CONFIRMED) confirmed.push(dto);
      else rejected.push(dto);
    }

    const pool = await this.prisma.incident.findMany({
      where: { id: { not: incidentId } },
      orderBy: { reportedAt: 'desc' },
      take: CANDIDATE_POOL_LIMIT,
    });

    const candidates: DuplicateCandidateDto[] = [];
    for (const other of pool) {
      if (resolvedKeys.has(this.pairKey(incidentId, other.id))) {
        continue;
      }

      const evaluation = evaluateDuplicate(target, other);
      if (!evaluation.isCandidate) {
        continue;
      }

      candidates.push({
        incident: other,
        score: evaluation.score,
        signals: evaluation.signals as DuplicateSignalsDto,
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    return { incidentId, candidates, confirmed, rejected };
  }

  async confirm(
    incidentId: string,
    duplicateId: string,
    actor: AuthenticatedUser,
  ): Promise<ResolvedDuplicateDto> {
    return this.resolve(incidentId, duplicateId, actor, DuplicateStatus.CONFIRMED);
  }

  async reject(
    incidentId: string,
    duplicateId: string,
    actor: AuthenticatedUser,
  ): Promise<ResolvedDuplicateDto> {
    return this.resolve(incidentId, duplicateId, actor, DuplicateStatus.REJECTED);
  }

  private async resolve(
    incidentId: string,
    duplicateId: string,
    actor: AuthenticatedUser,
    status: DuplicateStatus,
  ): Promise<ResolvedDuplicateDto> {
    if (incidentId === duplicateId) {
      throw new ConflictException('An incident cannot be a duplicate of itself');
    }

    const [target, duplicate] = await Promise.all([
      this.prisma.incident.findUnique({ where: { id: incidentId } }),
      this.prisma.incident.findUnique({ where: { id: duplicateId } }),
    ]);

    if (!target || !duplicate) {
      throw new NotFoundException('Incident not found');
    }

    const evaluation = evaluateDuplicate(target, duplicate);
    if (!evaluation.isCandidate) {
      throw new ConflictException('The pair is not a duplicate candidate');
    }

    const record = await this.prisma.incidentDuplicate.upsert({
      where: {
        incidentId_duplicateIncidentId: { incidentId, duplicateIncidentId: duplicateId },
      },
      update: {
        status,
        score: evaluation.score,
        signals: evaluation.signals as unknown as Prisma.InputJsonObject,
        confirmedById: actor.id,
        confirmedAt: new Date(),
      },
      create: {
        incidentId,
        duplicateIncidentId: duplicateId,
        status,
        score: evaluation.score,
        signals: evaluation.signals as unknown as Prisma.InputJsonObject,
        confirmedById: actor.id,
        confirmedAt: new Date(),
      },
    });

    return this.toResolvedDtoWithIncident(record, duplicate, actor.id);
  }

  private toResolvedDto(
    incidentId: string,
    record: IncidentDuplicate & { incident: Incident; duplicate: Incident },
  ): ResolvedDuplicateDto {
    const other = record.incidentId === incidentId ? record.duplicate : record.incident;
    return this.toResolvedDtoWithIncident(record, other, record.confirmedById);
  }

  private toResolvedDtoWithIncident(
    record: IncidentDuplicate,
    other: Incident,
    confirmedById: string | null,
  ): ResolvedDuplicateDto {
    return {
      id: record.id,
      status: record.status,
      incident: other,
      score: record.score,
      signals: record.signals as unknown as DuplicateSignalsDto,
      confirmedAt: record.confirmedAt,
      confirmedById,
    };
  }

  private pairKey(a: string, b: string): string {
    return [a, b].sort().join(':');
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Incident, IncidentEvent, IncidentEventType, IncidentStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { calculatePriority } from '../triage/priority.rules';
import { AvailableTransitionsDto } from './dto/available-transitions.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentListResponseDto } from './dto/incident-list-response.dto';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { TransitionIncidentDto } from './dto/transition-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { allowedTransitions, isTransitionAllowed } from './incident-state-machine';

const UPDATABLE_FIELDS = [
  'incidentType',
  'description',
  'locationText',
  'roadName',
  'kilometerMarker',
  'direction',
  'riskFactors',
] as const;

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateIncidentDto, actor: AuthenticatedUser): Promise<Incident> {
    const priority = calculatePriority(dto.incidentType ?? null, dto.riskFactors ?? []);

    const incident = await this.prisma.incident.create({
      data: {
        originalReport: dto.originalReport,
        incidentType: dto.incidentType ?? null,
        description: dto.description ?? null,
        locationText: dto.locationText ?? null,
        roadName: dto.roadName ?? null,
        kilometerMarker: dto.kilometerMarker ?? null,
        direction: dto.direction ?? null,
        priority,
        riskFactors: dto.riskFactors ?? [],
        status: IncidentStatus.REPORTED,
        createdById: actor.id,
      },
    });

    await this.prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: IncidentEventType.INCIDENT_CREATED,
        actorId: actor.id,
        metadata: { source: 'manual' },
      },
    });

    return incident;
  }

  async list(dto: ListIncidentsDto): Promise<IncidentListResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const where: Prisma.IncidentWhereInput = {};

    if (dto.status) {
      where.status = dto.status;
    }
    if (dto.priority) {
      where.priority = dto.priority;
    }
    if (dto.incidentType) {
      where.incidentType = dto.incidentType;
    }
    if (dto.roadName) {
      where.roadName = { contains: dto.roadName, mode: 'insensitive' };
    }
    if (dto.q) {
      where.OR = [
        { originalReport: { contains: dto.q, mode: 'insensitive' } },
        { description: { contains: dto.q, mode: 'insensitive' } },
        { locationText: { contains: dto.q, mode: 'insensitive' } },
        { roadName: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        orderBy: { reportedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async update(id: string, dto: UpdateIncidentDto, actor: AuthenticatedUser): Promise<Incident> {
    const requestedFields = UPDATABLE_FIELDS.filter((field) => dto[field] !== undefined);
    if (requestedFields.length === 0) {
      throw new BadRequestException('At least one incident field must be provided');
    }

    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({ where: { id } });
      if (!incident) {
        throw new NotFoundException('Incident not found');
      }

      const changedFields = requestedFields.filter(
        (field) => JSON.stringify(incident[field]) !== JSON.stringify(dto[field]),
      );
      if (changedFields.length === 0) {
        return incident;
      }

      const nextType = dto.incidentType ?? incident.incidentType;
      const nextRiskFactors = dto.riskFactors ?? incident.riskFactors;
      const priority = calculatePriority(nextType, nextRiskFactors);

      const updated = await tx.incident.update({
        where: { id },
        data: {
          incidentType: dto.incidentType,
          description: dto.description,
          locationText: dto.locationText,
          roadName: dto.roadName,
          kilometerMarker: dto.kilometerMarker,
          direction: dto.direction,
          riskFactors: dto.riskFactors,
          priority,
        },
      });

      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: IncidentEventType.ATTRIBUTE_CHANGED,
          actorId: actor.id,
          metadata: {
            changedFields,
            before: pick(incident, changedFields),
            after: pick(dto, changedFields),
          } as Prisma.InputJsonObject,
        },
      });

      if (incident.priority !== priority) {
        await tx.incidentEvent.create({
          data: {
            incidentId: id,
            type: IncidentEventType.PRIORITY_CHANGED,
            actorId: actor.id,
            metadata: { from: incident.priority, to: priority },
          },
        });
      }

      return updated;
    });
  }

  async availableTransitions(id: string): Promise<AvailableTransitionsDto> {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return { current: incident.status, allowed: [...allowedTransitions(incident.status)] };
  }

  async transition(
    id: string,
    dto: TransitionIncidentDto,
    actor: AuthenticatedUser,
  ): Promise<Incident> {
    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({ where: { id } });
      if (!incident) {
        throw new NotFoundException('Incident not found');
      }

      if (incident.status === dto.to) {
        throw new ConflictException(`Incident is already in status ${dto.to}`);
      }

      if (!isTransitionAllowed(incident.status, dto.to)) {
        throw new ConflictException(
          `Invalid status transition from ${incident.status} to ${dto.to}`,
        );
      }

      const now = new Date();
      const updateResult = await tx.incident.updateMany({
        where: { id, status: incident.status },
        data: {
          status: dto.to,
          resolvedAt: dto.to === IncidentStatus.RESOLVED ? now : undefined,
          cancelledAt: dto.to === IncidentStatus.CANCELLED ? now : undefined,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Incident status changed during the transition; retry');
      }

      const updated = await tx.incident.findUniqueOrThrow({ where: { id } });

      const eventType =
        dto.to === IncidentStatus.RESOLVED
          ? IncidentEventType.RESOLVED
          : dto.to === IncidentStatus.CANCELLED
            ? IncidentEventType.CANCELLED
            : IncidentEventType.STATUS_TRANSITION;

      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: eventType,
          actorId: actor.id,
          metadata: {
            from: incident.status,
            to: dto.to,
            ...(dto.reason ? { reason: dto.reason } : {}),
          },
        },
      });

      return updated;
    });
  }

  async findOne(id: string): Promise<Incident> {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  async findEvents(id: string): Promise<IncidentEvent[]> {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return this.prisma.incidentEvent.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'asc' },
    });
  }
}

function pick<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as Pick<T, K>;
}

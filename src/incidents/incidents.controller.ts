import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Incident, IncidentEvent, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AvailableTransitionsDto } from './dto/available-transitions.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentEventResponseDto } from './dto/incident-event-response.dto';
import { IncidentListResponseDto } from './dto/incident-list-response.dto';
import { IncidentResponseDto } from './dto/incident-response.dto';
import { ListIncidentsDto } from './dto/list-incidents.dto';
import { TransitionIncidentDto } from './dto/transition-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Manually create an incident (no AI required)' })
  @ApiCreatedResponse({ type: IncidentResponseDto })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Incident> {
    return this.incidentsService.create(dto, actor);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
  @ApiOperation({ summary: 'List incidents with pagination and filters' })
  @ApiResponse({ status: HttpStatus.OK, type: IncidentListResponseDto })
  list(@Query() query: ListIncidentsDto): Promise<IncidentListResponseDto> {
    return this.incidentsService.list(query);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({
    summary: 'Update permitted incident fields',
    description:
      'Updates operational fields and recalculates priority deterministically. Status and priority cannot be set directly.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: IncidentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Incident> {
    return this.incidentsService.update(id, dto, actor);
  }

  @Get(':id/available-transitions')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
  @ApiOperation({ summary: 'List status transitions permitted by the backend state machine' })
  @ApiResponse({ status: HttpStatus.OK, type: AvailableTransitionsDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  availableTransitions(@Param('id') id: string): Promise<AvailableTransitionsDto> {
    return this.incidentsService.availableTransitions(id);
  }

  @Post(':id/transitions')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a validated incident status transition' })
  @ApiResponse({ status: HttpStatus.OK, type: IncidentResponseDto })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Transition is not allowed' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionIncidentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Incident> {
    return this.incidentsService.transition(id, dto, actor);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
  @ApiOperation({ summary: 'Retrieve incident details' })
  @ApiResponse({ status: HttpStatus.OK, type: IncidentResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  findOne(@Param('id') id: string): Promise<Incident> {
    return this.incidentsService.findOne(id);
  }

  @Get(':id/events')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
  @ApiOperation({ summary: 'Retrieve incident history (audit events)' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [IncidentEventResponseDto],
    description: 'Incident history',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  findEvents(@Param('id') id: string): Promise<IncidentEvent[]> {
    return this.incidentsService.findEvents(id);
  }
}

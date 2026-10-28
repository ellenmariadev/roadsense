import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Incident, TriageRun, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { IncidentResponseDto } from '../incidents/dto/incident-response.dto';
import { CreateTriageDto } from './dto/create-triage.dto';
import { RejectTriageDto } from './dto/reject-triage.dto';
import { TriageRunResponseDto } from './dto/triage-response.dto';
import { TriageService } from './triage.service';

@ApiTags('triage')
@ApiBearerAuth()
@Controller()
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('triage')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Execute AI-assisted extraction for a report' })
  @ApiCreatedResponse({
    description: 'Triage executed (SUCCEEDED or FAILED) and persisted',
    type: TriageRunResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  create(@Body() dto: CreateTriageDto): Promise<TriageRun> {
    return this.triageService.create(dto);
  }

  @Get('triage/:id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
  @ApiOperation({ summary: 'Retrieve a triage execution and its result' })
  @ApiResponse({ status: HttpStatus.OK, type: TriageRunResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  findOne(@Param('id') id: string): Promise<TriageRun> {
    return this.triageService.findOne(id);
  }

  @Get('incidents/:incidentId/triage')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
  @ApiOperation({ summary: 'List triage runs for an incident, newest first' })
  @ApiResponse({ status: HttpStatus.OK, type: [TriageRunResponseDto] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  findByIncident(@Param('incidentId') incidentId: string): Promise<TriageRun[]> {
    return this.triageService.findByIncident(incidentId);
  }

  @Post('incidents/:incidentId/triage/:triageId/confirm')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm an eligible triage suggestion (authorized human confirmation)',
  })
  @ApiResponse({ status: HttpStatus.OK, type: IncidentResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  @ApiResponse({ status: HttpStatus.CONFLICT })
  confirm(
    @Param('incidentId') incidentId: string,
    @Param('triageId') triageId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Incident> {
    return this.triageService.confirm(incidentId, triageId, actor);
  }

  @Post('incidents/:incidentId/triage/:triageId/reject')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject an eligible triage suggestion (authorized human decision)',
    description: 'Records the rejection without changing the incident fields or status.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: TriageRunResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  @ApiResponse({ status: HttpStatus.CONFLICT })
  reject(
    @Param('incidentId') incidentId: string,
    @Param('triageId') triageId: string,
    @Body() dto: RejectTriageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TriageRun> {
    return this.triageService.reject(incidentId, triageId, actor, dto);
  }
}

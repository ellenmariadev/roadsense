import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { DuplicateCandidatesResponseDto, ResolvedDuplicateDto } from './dto/duplicate-response.dto';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('incidents')
export class DuplicatesController {
  constructor(private readonly duplicateDetection: DuplicateDetectionService) {}

  @Get(':id/duplicate-candidates')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Detect duplicate candidates for an incident',
    description:
      'Deterministic, explainable similarity matching (road, km, type, description, time). ' +
      'Returns candidates only — never merges, deletes or changes incident status.',
  })
  @ApiOkResponse({ type: DuplicateCandidatesResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  findCandidates(@Param('id') id: string): Promise<DuplicateCandidatesResponseDto> {
    return this.duplicateDetection.findCandidates(id);
  }

  @Post(':id/duplicate-candidates/:duplicateId/confirm')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a duplicate candidate (authorized human action)',
    description: 'Records a confirmed duplicate relationship without changing incident status.',
  })
  @ApiOkResponse({ type: ResolvedDuplicateDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  @ApiResponse({ status: HttpStatus.CONFLICT })
  confirm(
    @Param('id') id: string,
    @Param('duplicateId') duplicateId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResolvedDuplicateDto> {
    return this.duplicateDetection.confirm(id, duplicateId, actor);
  }

  @Post(':id/duplicate-candidates/:duplicateId/reject')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a duplicate candidate (authorized human action)',
    description: 'Records a rejected candidate without changing incident status.',
  })
  @ApiOkResponse({ type: ResolvedDuplicateDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  @ApiResponse({ status: HttpStatus.FORBIDDEN })
  @ApiResponse({ status: HttpStatus.CONFLICT })
  reject(
    @Param('id') id: string,
    @Param('duplicateId') duplicateId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResolvedDuplicateDto> {
    return this.duplicateDetection.reject(id, duplicateId, actor);
  }
}

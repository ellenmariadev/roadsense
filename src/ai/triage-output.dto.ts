import { IncidentType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import { LlmOutputValidationError } from './llm-provider.interface';

/**
 * Runtime schema for the AI triage output. Every field is optional: fields the
 * model cannot reliably extract must be omitted (preserved as null/missing),
 * never invented.
 */
export class TriageOutputDto {
  @IsOptional()
  @IsEnum(IncidentType)
  incidentType?: IncidentType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  locationText?: string;

  @IsOptional()
  @IsString()
  roadName?: string;

  @IsOptional()
  @IsString()
  kilometerMarker?: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskFactors?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingInformation?: string[];

  @IsOptional()
  @IsString()
  sourceText?: string;
}

/**
 * Validates untrusted LLM output. Malformed or schema-invalid output (including
 * unknown/unsupported fields) is rejected. Missing fields are preserved as
 * undefined (mapped to null when persisted).
 */
export function validateTriageOutput(value: unknown): TriageOutputDto {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new LlmOutputValidationError('LLM output must be a JSON object');
  }

  const instance = plainToInstance(TriageOutputDto, value);

  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new LlmOutputValidationError(details);
  }

  return instance;
}

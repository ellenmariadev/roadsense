import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { IncidentType, UserRole } from './types';

export class LoginFormDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString({ message: 'Informe a senha.' })
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(128, { message: 'A senha deve ter no máximo 128 caracteres.' })
  password!: string;
}

export class RegisterUserFormDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(128, { message: 'A senha deve ter no máximo 128 caracteres.' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  name?: string;

  @IsEnum(['ADMIN', 'OPERATOR', 'VIEWER'], { message: 'Selecione um perfil válido.' })
  role!: UserRole;
}

export class IncidentFormDto {
  @IsString()
  @IsNotEmpty({ message: 'Descreva o incidente.' })
  @MaxLength(10000, { message: 'O relato deve ter no máximo 10.000 caracteres.' })
  originalReport!: string;

  @IsOptional()
  @IsEnum(
    [
      'ACCIDENT',
      'VEHICLE_BREAKDOWN',
      'ROAD_OBSTRUCTION',
      'FLOODING',
      'INFRASTRUCTURE_DAMAGE',
      'OTHER',
    ],
    {
      message: 'Selecione um tipo válido.',
    },
  )
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
  @IsString()
  @MaxLength(1000, { message: 'Os fatores de risco devem ter no máximo 1.000 caracteres.' })
  riskFactorsText?: string;
}

export class TriageFormDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o texto que será analisado.' })
  @MaxLength(10000, { message: 'O texto deve ter no máximo 10.000 caracteres.' })
  sourceText!: string;
}

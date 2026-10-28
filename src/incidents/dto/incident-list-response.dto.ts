import { ApiProperty } from '@nestjs/swagger';
import { IncidentResponseDto } from './incident-response.dto';

export class IncidentListResponseDto {
  @ApiProperty({ type: [IncidentResponseDto] })
  items: IncidentResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

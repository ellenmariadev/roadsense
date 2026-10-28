import { Module } from '@nestjs/common';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { DuplicatesController } from './duplicates.controller';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  controllers: [IncidentsController, DuplicatesController],
  providers: [IncidentsService, DuplicateDetectionService],
})
export class IncidentsModule {}

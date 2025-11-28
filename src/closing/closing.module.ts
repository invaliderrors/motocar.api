import { Module } from '@nestjs/common';
import { ClosingController } from './closing.controller';
import { ClosingService } from './closing.service';

@Module({
  providers: [ClosingService],
  controllers: [ClosingController],
})
export class ClosingModule {}

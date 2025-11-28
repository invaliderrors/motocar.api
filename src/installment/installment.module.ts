import { Module } from '@nestjs/common';
import { InstallmentService } from './installment.service';
import { InstallmentController } from './installment.controller';

@Module({
  providers: [InstallmentService],
  controllers: [InstallmentController],
})
export class InstallmentModule {}

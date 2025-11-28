import { Module } from '@nestjs/common';
import { ContractService } from './contracts.service';
import { ContractController } from './contracts.controller';

@Module({
  providers: [ContractService],
  controllers: [ContractController]
})
export class ContractsModule { }

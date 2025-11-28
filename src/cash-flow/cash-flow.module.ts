import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Controllers
import { CashFlowAccountController } from './controllers/account.controller';
import { CashFlowTransactionController } from './controllers/transaction.controller';
import { CashFlowTransferController } from './controllers/transfer.controller';
import { CashFlowRuleController } from './controllers/rule.controller';
import { CashFlowReportController } from './controllers/report.controller';

// Services
import { CashFlowAccountService } from './services/account.service';
import { CashFlowTransactionService } from './services/transaction.service';
import { CashFlowTransferService } from './services/transfer.service';
import { CashFlowRuleService } from './services/rule.service';
import { CashFlowReportService } from './services/report.service';

@Module({
  controllers: [
    CashFlowAccountController,
    CashFlowTransactionController,
    CashFlowTransferController,
    CashFlowRuleController,
    CashFlowReportController,
  ],
  providers: [
    PrismaService,
    CashFlowAccountService,
    CashFlowTransactionService,
    CashFlowTransferService,
    CashFlowRuleService,
    CashFlowReportService,
  ],
  exports: [
    CashFlowAccountService,
    CashFlowTransactionService,
    CashFlowTransferService,
    CashFlowRuleService,
    CashFlowReportService,
  ],
})
export class CashFlowModule {}

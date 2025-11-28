import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CashFlowReportService } from '../services/report.service';
import { CashFlowStatementDto, ForecastDto } from '../dto/report.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { LogAction, ActionType } from '../../lib/decorators/log-action.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('cash-flow/reports')
@UseGuards()
export class CashFlowReportController {
  constructor(private readonly reportService: CashFlowReportService) {}

  @Post('cash-flow-statement')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'CashFlowReport', 'Generate cash flow statement')
  generateCashFlowStatement(@Body() dto: CashFlowStatementDto) {
    return this.reportService.generateCashFlowStatement(dto);
  }

  @Post('forecast')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'CashFlowReport', 'Generate forecast')
  generateForecast(@Body() dto: ForecastDto) {
    return this.reportService.generateForecast(dto);
  }
}

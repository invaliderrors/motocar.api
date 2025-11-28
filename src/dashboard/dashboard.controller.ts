import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) { }

  @Get()
  @LogAction(ActionType.QUERY, 'Dashboard', 'Get dashboard data')
  getDashboardData(@Query('dateRange') dateRange?: string) {
    return this.service.getDashboardData(dateRange);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  @LogAction(ActionType.QUERY, 'Analytics', 'Revenue analytics')
  async getRevenueAnalytics(
    @Query('storeId') storeId?: string,
    @Query('days') days?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const daysNumber = days ? parseInt(days) : 90;
    return this.analyticsService.getRevenueAnalytics({
      storeId,
      days: daysNumber,
      startDate,
      endDate,
    });
  }
}

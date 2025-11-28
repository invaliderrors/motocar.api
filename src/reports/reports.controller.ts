import { Controller, Get, Query, UseGuards, Param, Res, StreamableFile } from '@nestjs/common';
import { ReportsService, ReportFilters } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { UserStoreId } from '../auth/decorators/store.decorator';
import { Response } from 'express';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('loans')
  @LogAction(ActionType.QUERY, 'Report', 'Loan report')
  async getLoanReport(@Query() filters: ReportFilters, @UserStoreId() userStoreId: string | null) {
    console.log('🎯 ReportsController.getLoanReport - userStoreId:', userStoreId);
    console.log('🎯 ReportsController.getLoanReport - filters:', filters);
    return this.reportsService.getLoanReport(filters, userStoreId);
  }

  @Get('payments')
  @LogAction(ActionType.QUERY, 'Report', 'Payment report')
  async getPaymentReport(@Query() filters: ReportFilters, @UserStoreId() userStoreId: string | null) {
    return this.reportsService.getPaymentReport(filters, userStoreId);
  }

  @Get('clients')
  @LogAction(ActionType.QUERY, 'Report', 'Client report')
  async getClientReport(@Query() filters: ReportFilters, @UserStoreId() userStoreId: string | null) {
    return this.reportsService.getClientReport(filters, userStoreId);
  }

  @Get('vehicles')
  @LogAction(ActionType.QUERY, 'Report', 'Vehicle report')
  async getVehicleReport(@Query() filters: ReportFilters, @UserStoreId() userStoreId: string | null) {
    return this.reportsService.getVehicleReport(filters, userStoreId);
  }

  @Get('missing-installments')
  @LogAction(ActionType.QUERY, 'Report', 'Missing installments report')
  async getMissingInstallmentsReport(@Query() filters: ReportFilters, @UserStoreId() userStoreId: string | null) {
    return this.reportsService.getMissingInstallmentsReport(filters, userStoreId);
  }

  @Get('vehicle-status')
  @LogAction(ActionType.QUERY, 'Report', 'Vehicle status report')
  async getVehicleStatusReport(@Query() filters: ReportFilters, @UserStoreId() userStoreId: string | null) {
    return this.reportsService.getVehicleStatusReport(filters, userStoreId);
  }

  // Export endpoints
  @Get('export/:type/:format')
  @LogAction(ActionType.EXPORT, 'Report')
  async exportReport(
    @Param('type') type: string,
    @Param('format') format: string,
    @Query() filters: ReportFilters,
    @UserStoreId() userStoreId: string | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.reportsService.exportReport(type, format, filters, userStoreId);
    
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });
    
    return new StreamableFile(result.buffer);
  }
}

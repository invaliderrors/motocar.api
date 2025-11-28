import { Body, Controller, Get, Param, Post, Query, Res, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ClosingService } from './closing.service';
import {
  CreateCashRegisterDto,
  FilterCashRegisterDto,
  FilterInstallmentsDto,
  GetResumenDto,
  FindOneCashRegisterResponseDto,
  PrintClosingDto,
} from './dto';

import { Response } from 'express';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserStoreId } from '../auth/decorators/store.decorator';
import { CashRegister, UserRole } from 'src/prisma/generated/client';

@Controller('closing')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class ClosingController {
  constructor(private readonly closingService: ClosingService) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'Closing')
  create(
    @Body() dto: CreateCashRegisterDto,
    @UserStoreId() userStoreId: string | null,
  ): Promise<CashRegister & { payments: Installment[] }> {
    return this.closingService.create(dto, userStoreId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Closing')
  findAll(
    @Query() filter: FilterCashRegisterDto,
    @UserStoreId() userStoreId: string | null,
  ): Promise<(
    CashRegister & {
      payments: Installment[];
      expense: Expense[];
      createdBy: { id: string; username: string } | null;
    }
  )[]> {
    return this.closingService.findAll(filter, userStoreId);
  }

  @Get('search/:id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Closing')
  findOne(
    @Param('id') id: string,
    @UserStoreId() userStoreId: string | null,
  ): Promise<FindOneCashRegisterResponseDto> {
    return this.closingService.findOne(id, userStoreId);
  }

  @Get('available-payments')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Closing', 'Get unassigned payments')
  getUnassignedPayments(
    @Query() filter: FilterInstallmentsDto,
    @UserStoreId() userStoreId: string | null,
  ): ReturnType<ClosingService['getUnassignedPayments']> {
    return this.closingService.getUnassignedPayments(filter, userStoreId);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Closing', 'Get closing summary')
  getResumen(
    @Query() query: GetResumenDto,
    @UserStoreId() userStoreId: string | null,
  ): ReturnType<ClosingService['summary']> {
    return this.closingService.summary(query, userStoreId);
  }

  @Get('print/:id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.EXPORT, 'Closing', 'Print closing PDF')
  async printClosing(
    @Param('id') id: string,
    @UserStoreId() userStoreId: string | null,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.closingService.printClosing(id, userStoreId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=closing-${id}.pdf`);
      
      return res.send(pdfBuffer);
    } catch (err) {
      console.error(err);
      throw new HttpException('No se pudo generar el PDF del cierre.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

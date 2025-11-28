import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { LoanService } from './loan.service';
import { CreateLoanDto, UpdateLoanDto, UpdateLoanDatesDto, UpdateLoanStatusDto } from './loan.dto';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserStoreId } from '../auth/decorators/store.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('loans')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class LoanController {
  constructor(private readonly loanService: LoanService) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'Loan')
  create(@Body() dto: CreateLoanDto, @UserStoreId() userStoreId: string | null) {
    return this.loanService.create(dto, userStoreId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Loan')
  findAll(@UserStoreId() userStoreId: string | null) {
    return this.loanService.findAll(userStoreId);
  }

  @Get('with-status')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Loan', 'Query loans with status')
  findAllWithStatus(@UserStoreId() userStoreId: string | null) {
    return this.loanService.findAllWithStatus(userStoreId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Loan')
  findOne(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.loanService.findOne(id, userStoreId);
  }

  @Get(':id/status')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Loan', 'Get loan status')
  getLoanStatus(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.loanService.getLoanStatus(id, userStoreId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.UPDATE, 'Loan')
  update(@Param('id') id: string, @Body() dto: UpdateLoanDto, @UserStoreId() userStoreId: string | null) {
    return this.loanService.update(id, dto, userStoreId);
  }

  @Put(':id/recalculate')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CUSTOM, 'Loan', 'Recalculate installments')
  async recalculateInstallments(@Param('id') id: string) {
    return this.loanService.recalculateInstallments(id);
  }

  @Put(':id/dates')
  @LogAction(ActionType.UPDATE, 'Loan', 'Update loan dates')
  async updateLoanDates(
    @Param('id') id: string,
    @Body() body: UpdateLoanDatesDto
  ) {
    return this.loanService.updateLoanDates(id, body.startDate, body.endDate);
  }

  @Post(':id/archive')
  @LogAction(ActionType.ARCHIVE, 'Loan')
  async archiveLoan(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.loanService.archive(id);
    return { ok: true };
  }


  @Post(':id/unarchive')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.RESTORE, 'Loan')
  async unarchiveLoan(@Param('id') id: string): Promise<{ ok: boolean }> {
    await this.loanService.unarchive(id);
    return { ok: true };
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.UPDATE, 'Loan', 'Update loan status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLoanStatusDto,
    @UserStoreId() userStoreId: string | null
  ) {
    return this.loanService.updateStatus(id, dto.status, userStoreId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'Loan')
  remove(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.loanService.remove(id, userStoreId);
  }
}

import { Body, Controller, Get, Param, Post, Put, Delete, Query, UseGuards } from '@nestjs/common';
import { CreateExpenseDto, FindExpenseFiltersDto } from './dto';
import { ExpenseService } from './expense.service';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserStoreId } from '../auth/decorators/store.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('expense')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class ExpenseController {
  constructor(private readonly service: ExpenseService) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'Expense')
  create(@Body() dto: CreateExpenseDto, @UserStoreId() userStoreId: string | null) {
    if (!userStoreId) {
      throw new Error('ADMIN users must provide storeId when creating expenses');
    }
    return this.service.create(dto, userStoreId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Expense')
  findAll(@Query() filters: FindExpenseFiltersDto, @UserStoreId() userStoreId: string | null) {
    return this.service.findAll(filters, userStoreId);
  }


  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.UPDATE, 'Expense')
  update(@Param('id') id: string, @Body() dto: CreateExpenseDto, @UserStoreId() userStoreId: string | null) {
    return this.service.update(id, dto, userStoreId);
  }

  @Get('cash-register/:id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Expense', 'Find by cash register')
  findByCashRegister(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.service.findByCashRegisterId(id, userStoreId);
  }


  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'Expense')
  delete(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.service.delete(id, userStoreId);
  }

}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CashFlowTransactionService } from '../services/transaction.service';
import {
  CreateTransactionDto,
  CreateBatchTransactionsDto,
  UpdateTransactionDto,
  TransactionQueryDto,
} from '../dto/transaction.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { LogAction, ActionType } from '../../lib/decorators/log-action.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('cash-flow/transactions')
@UseGuards()
export class CashFlowTransactionController {
  constructor(private readonly transactionService: CashFlowTransactionService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'CashFlowTransaction')
  create(@Body() dto: CreateTransactionDto, @Req() req: any) {
    return this.transactionService.create(dto, req.user?.userId);
  }

  @Post('batch')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'CashFlowTransaction', 'Create batch transactions')
  createBatch(@Body() dto: CreateBatchTransactionsDto, @Req() req: any) {
    return this.transactionService.createBatch(dto, req.user?.userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'CashFlowTransaction')
  findAll(@Query() query: TransactionQueryDto) {
    return this.transactionService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'CashFlowTransaction')
  findOne(@Param('id') id: string) {
    return this.transactionService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.UPDATE, 'CashFlowTransaction')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'CashFlowTransaction')
  remove(@Param('id') id: string) {
    return this.transactionService.remove(id);
  }
}

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
import { CashFlowAccountService } from '../services/account.service';
import { CreateAccountDto, UpdateAccountDto, AccountQueryDto } from '../dto/account.dto';
import { Roles } from '../../auth/decorators/roles.decorator';

import { LogAction, ActionType } from '../../lib/decorators/log-action.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('cash-flow/accounts')
@UseGuards()
export class CashFlowAccountController {
  constructor(private readonly accountService: CashFlowAccountService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'CashFlowAccount')
  create(@Body() dto: CreateAccountDto, @Req() req: any) {
    return this.accountService.create(dto, req.user?.userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'CashFlowAccount')
  findAll(@Query() query: AccountQueryDto) {
    return this.accountService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'CashFlowAccount')
  findOne(@Param('id') id: string) {
    return this.accountService.findOne(id);
  }

  @Get(':id/balance')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'CashFlowAccount', 'Get account balance')
  getBalance(@Param('id') id: string, @Query('asOfDate') asOfDate?: string) {
    const date = asOfDate ? new Date(asOfDate) : undefined;
    return this.accountService.getBalance(id, date);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.UPDATE, 'CashFlowAccount')
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'CashFlowAccount')
  remove(@Param('id') id: string) {
    return this.accountService.remove(id);
  }
}

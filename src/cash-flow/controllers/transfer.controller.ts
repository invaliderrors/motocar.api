import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CashFlowTransferService } from '../services/transfer.service';
import { CreateTransferDto } from '../dto/transfer.dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { LogAction, ActionType } from '../../lib/decorators/log-action.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('cash-flow/transfers')
@UseGuards()
export class CashFlowTransferController {
  constructor(private readonly transferService: CashFlowTransferService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'CashFlowTransfer')
  create(@Body() dto: CreateTransferDto, @Req() req: any) {
    return this.transferService.create(dto, req.user?.userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'CashFlowTransfer')
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.transferService.findAll(page, limit);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'CashFlowTransfer')
  findOne(@Param('id') id: string) {
    return this.transferService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'CashFlowTransfer')
  remove(@Param('id') id: string) {
    return this.transferService.remove(id);
  }
}

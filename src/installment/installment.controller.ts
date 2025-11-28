import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InstallmentService } from './installment.service';
import { CreateInstallmentDto, FindInstallmentFiltersDto, UpdateInstallmentDto } from './installment.dto';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserStoreId } from '../auth/decorators/store.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('installments')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class InstallmentController {
  constructor(private readonly service: InstallmentService) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'Installment')
  create(@Body() dto: CreateInstallmentDto, @UserStoreId() userStoreId: string | null) {
    return this.service.create(dto, userStoreId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Installment')
  findAll(@Query() filters: FindInstallmentFiltersDto, @UserStoreId() userStoreId: string | null) {
    return this.service.findAll(filters, userStoreId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Installment')
  findOne(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.service.findOne(id, userStoreId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.UPDATE, 'Installment')
  update(@Param('id') id: string, @Body() dto: UpdateInstallmentDto, @UserStoreId() userStoreId: string | null) {
    return this.service.update(id, dto, userStoreId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'Installment')
  remove(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.service.remove(id, userStoreId);
  }
}

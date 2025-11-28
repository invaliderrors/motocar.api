import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto, UpdateVehicleDto, FindVehicleFiltersDto } from './vehicle.dto';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserStoreId } from '../auth/decorators/store.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class VehicleController {
  constructor(private readonly service: VehicleService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'Vehicle')
  create(@Body() dto: CreateVehicleDto, @UserStoreId() userStoreId: string | null) {
    if (!userStoreId) {
      throw new Error('ADMIN users must provide storeId when creating vehicles');
    }
    return this.service.create(dto, userStoreId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Vehicle')
  findAll(@Query() filters: FindVehicleFiltersDto, @UserStoreId() userStoreId: string | null) {
    return this.service.findAll(filters, userStoreId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Vehicle')
  findOne(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.service.findOne(id, userStoreId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.UPDATE, 'Vehicle')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @UserStoreId() userStoreId: string | null) {
    return this.service.update(id, dto, userStoreId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'Vehicle')
  remove(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.service.remove(id, userStoreId);
  }
}

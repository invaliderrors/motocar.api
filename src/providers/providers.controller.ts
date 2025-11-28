import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserStoreId } from '../auth/decorators/store.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('providers')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'Provider')
  create(@Body() createProviderDto: CreateProviderDto, @UserStoreId() userStoreId: string | null) {
    if (!userStoreId) {
      throw new Error('ADMIN users must provide storeId when creating providers');
    }
    return this.providersService.create(createProviderDto, userStoreId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Provider')
  findAll(@UserStoreId() userStoreId: string | null) {
    return this.providersService.findAll(userStoreId);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Provider', 'Get provider statistics')
  getProvidersStats(@UserStoreId() userStoreId: string | null) {
    return this.providersService.getProvidersStats(userStoreId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Provider')
  findOne(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.providersService.findOne(id, userStoreId);
  }

  @Get(':id/details')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Provider', 'Get provider details')
  getProviderDetails(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.providersService.getProviderDetails(id, userStoreId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.UPDATE, 'Provider')
  update(@Param('id') id: string, @Body() updateProviderDto: UpdateProviderDto, @UserStoreId() userStoreId: string | null) {
    return this.providersService.update(id, updateProviderDto, userStoreId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'Provider')
  remove(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.providersService.remove(id, userStoreId);
  }
}

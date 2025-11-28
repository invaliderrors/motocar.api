import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserStoreId } from '../auth/decorators/store.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('users')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class UserController {
  constructor(private readonly service: UserService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.CREATE, 'User')
  create(@Body() dto: CreateUserDto, @UserStoreId() userStoreId: string | null) {
    if (!userStoreId) {
      throw new Error('ADMIN users must provide storeId when creating users');
    }
    return this.service.create(dto, userStoreId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'User')
  findAll(@UserStoreId() userStoreId: string | null) {
    return this.service.findAll(userStoreId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'User')
  findOne(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.service.findOne(id, userStoreId);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.UPDATE, 'User')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @UserStoreId() userStoreId: string | null) {
    return this.service.update(id, dto, userStoreId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'User')
  remove(@Param('id') id: string, @UserStoreId() userStoreId: string | null) {
    return this.service.remove(id, userStoreId);
  }
}

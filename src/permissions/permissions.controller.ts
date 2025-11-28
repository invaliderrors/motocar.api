import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import {
  GrantPermissionDto,
  RevokePermissionDto,
  GrantResourcePermissionsDto,
  SetOwnerPermissionsDto,
  ApplyRolePermissionsDto,
  CheckPermissionDto,
  CheckMultiplePermissionsDto,
} from './dto/permission.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LogAction, ActionType } from '../lib/decorators/log-action.decorator';
import { CurrentUser } from '../auth/decorators/user';
import { JwtPayload } from '../auth/auth.service';
import { UserRole } from 'src/prisma/generated/client';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.QUERY, 'Permission', 'Get all available permissions')
  async getAllPermissions() {
    return {
      permissions: this.permissionsService.getAllPermissions(),
    };
  }

  @Get('grouped')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.QUERY, 'Permission', 'Get permissions grouped by resource')
  async getPermissionsGrouped() {
    return {
      permissions: this.permissionsService.getPermissionsGroupedByResource(),
    };
  }

  @Get('defaults/:role')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.QUERY, 'Permission', 'Get default permissions for role')
  async getDefaultPermissions(@Param('role') role: UserRole) {
    return {
      role,
      permissions: this.permissionsService.getDefaultPermissionsForRole(role),
    };
  }

  @Get('owner/:ownerId')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.QUERY, 'Permission', 'Get owner permissions')
  async getOwnerPermissions(@Param('ownerId') ownerId: string) {
    return this.permissionsService.getOwnerPermissions(ownerId);
  }

  @Post('owner/:ownerId/set')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.UPDATE, 'Permission', 'Set owner permissions')
  async setOwnerPermissions(
    @Param('ownerId') ownerId: string,
    @Body() dto: SetOwnerPermissionsDto,
  ) {
    return this.permissionsService.setOwnerPermissions(
      ownerId,
      dto.permissions,
      dto.updatedBy,
    );
  }

  @Post('owner/:ownerId/grant')
  @Roles('ADMIN')
  @LogAction(ActionType.CREATE, 'Permission', 'Grant permission to owner')
  async grantPermission(
    @Param('ownerId') ownerId: string,
    @Body() dto: GrantPermissionDto,
  ) {
    return this.permissionsService.grantPermission(
      ownerId,
      dto.resource,
      dto.action,
      dto.grantedBy,
    );
  }

  @Delete('owner/:ownerId/revoke')
  @Roles('ADMIN')
  @LogAction(ActionType.DELETE, 'Permission', 'Revoke permission from owner')
  async revokePermission(
    @Param('ownerId') ownerId: string,
    @Body() dto: RevokePermissionDto,
  ) {
    return this.permissionsService.revokePermission(
      ownerId,
      dto.resource,
      dto.action,
    );
  }

  @Post('owner/:ownerId/grant-resource')
  @Roles('ADMIN')
  @LogAction(ActionType.CREATE, 'Permission', 'Grant resource permissions to owner')
  async grantResourcePermissions(
    @Param('ownerId') ownerId: string,
    @Body() dto: GrantResourcePermissionsDto,
  ) {
    return this.permissionsService.grantResourcePermissions(
      ownerId,
      dto.resource,
      dto.actions,
      dto.grantedBy,
    );
  }

  @Post('owner/:ownerId/apply-role')
  @Roles('ADMIN')
  @LogAction(ActionType.UPDATE, 'Permission', 'Apply role permissions to owner')
  async applyRolePermissions(
    @Param('ownerId') ownerId: string,
    @Body() dto: ApplyRolePermissionsDto,
  ) {
    return this.permissionsService.applyRolePermissions(ownerId, dto.role);
  }

  @Delete('owner/:ownerId/clear')
  @Roles(UserRole.ADMIN)
  @LogAction(ActionType.DELETE, 'Permission', 'Clear owner permissions')
  async clearOwnerPermissions(@Param('ownerId') ownerId: string) {
    return this.permissionsService.clearOwnerPermissions(ownerId);
  }

  @Post('owner/:ownerId/check')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Permission', 'Check owner permission')
  async checkPermission(
    @Param('ownerId') ownerId: string,
    @Body() dto: CheckPermissionDto,
  ) {
    const hasPermission = await this.permissionsService.hasPermission(
      ownerId,
      dto.resource,
      dto.action,
    );
    return {
      ownerId,
      resource: dto.resource,
      action: dto.action,
      hasPermission,
    };
  }

  @Post('owner/:ownerId/check-any')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Permission', 'Check if owner has any permission')
  async checkAnyPermission(
    @Param('ownerId') ownerId: string,
    @Body() dto: CheckMultiplePermissionsDto,
  ) {
    const hasPermission = await this.permissionsService.hasAnyPermission(
      ownerId,
      dto.permissions,
    );
    return {
      ownerId,
      permissions: dto.permissions,
      hasAnyPermission: hasPermission,
    };
  }

  @Post('owner/:ownerId/check-all')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  @LogAction(ActionType.QUERY, 'Permission', 'Check if owner has all permissions')
  async checkAllPermissions(
    @Param('ownerId') ownerId: string,
    @Body() dto: CheckMultiplePermissionsDto,
  ) {
    const hasPermission = await this.permissionsService.hasAllPermissions(
      ownerId,
      dto.permissions,
    );
    return {
      ownerId,
      permissions: dto.permissions,
      hasAllPermissions: hasPermission,
    };
  }

  @Get('me')
  @LogAction(ActionType.QUERY, 'Permission', 'Get my permissions')
  async getMyPermissions(@CurrentUser() user: JwtPayload) {
    return this.permissionsService.getOwnerPermissions(user.sub);
  }

  @Post('me/check')
  @LogAction(ActionType.QUERY, 'Permission', 'Check my permission')
  async checkMyPermission(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CheckPermissionDto,
  ) {
    const hasPermission = await this.permissionsService.hasPermission(
      user.sub,
      dto.resource,
      dto.action,
    );
    return {
      resource: dto.resource,
      action: dto.action,
      hasPermission,
    };
  }
}

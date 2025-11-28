import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionsService } from '../../permissions/permissions.service';
import { PermissionCheck } from '../../permissions/permissions.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(forwardRef(() => PermissionsService))
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionCheck[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !user.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    // ADMIN role bypasses all permission checks
    if (user.roles && user.roles.includes('ADMIN')) {
      return true;
    }

    // Check if user has any of the required permissions
    for (const permission of requiredPermissions) {
      const hasPermission = await this.permissionsService.hasPermission(
        user.sub,
        permission.resource,
        permission.action,
      );

      if (hasPermission) {
        return true;
      }
    }

    throw new ForbiddenException(
      'You do not have the required permissions to access this resource',
    );
  }
}

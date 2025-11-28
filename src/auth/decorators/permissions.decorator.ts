import { SetMetadata } from '@nestjs/common';
import { PermissionCheck } from '../../permissions/permissions.types';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (...permissions: PermissionCheck[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

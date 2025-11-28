import { IsString, IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Resource, Action, PermissionsMap } from '../permissions.types';
import { UserRole } from 'src/prisma/generated/client';

export class GrantPermissionDto {
  @IsEnum(Resource)
  resource: Resource;

  @IsEnum(Action)
  action: Action;

  @IsString()
  grantedBy: string;
}

export class RevokePermissionDto {
  @IsEnum(Resource)
  resource: Resource;

  @IsEnum(Action)
  action: Action;
}

export class GrantResourcePermissionsDto {
  @IsEnum(Resource)
  resource: Resource;

  @IsArray()
  @IsEnum(Action, { each: true })
  actions: Action[];

  @IsString()
  grantedBy: string;
}

export class SetOwnerPermissionsDto {
  @IsOptional()
  permissions: PermissionsMap;

  @IsString()
  updatedBy: string;
}

export class ApplyRolePermissionsDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class CheckPermissionDto {
  @IsEnum(Resource)
  resource: Resource;

  @IsEnum(Action)
  action: Action;
}

export class CheckMultiplePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckPermissionDto)
  permissions: CheckPermissionDto[];
}

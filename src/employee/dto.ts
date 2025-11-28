import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsEnum, IsEmail } from 'class-validator';
import { PermissionsMap } from '../permissions/permissions.types';
import { UserRole } from 'src/prisma/generated/client';

export class CreateEmployeeDto {
    @IsString()
    name: string;

    @IsString()
    username: string;

    @IsString()
    password: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsOptional()
    @IsString()
    storeId?: string;

    @IsOptional()
    permissions?: PermissionsMap;

    @IsOptional()
    @IsString()
    status?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
    @IsOptional()
    @IsString()
    password?: string; // Make password optional for updates
}

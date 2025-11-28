import { PartialType } from '@nestjs/mapped-types';
import { IsNumber, IsString, IsUUID, IsOptional, IsEnum, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum VehicleType {
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
  TRUCK = 'TRUCK',
  VAN = 'VAN',
  ATV = 'ATV',
  OTHER = 'OTHER',
}

export class CreateVehicleDto {
  @IsUUID()
  providerId: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsString()
  plate: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  engine?: string;

  @IsOptional()
  @IsString()
  chassis?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  cc?: number;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsNumber()
  gps?: number;

  @IsOptional()
  @IsDateString()
  soatDueDate?: string;

  @IsOptional()
  @IsDateString()
  technomechDueDate?: string;
}

export class FindVehicleFiltersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  plate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) { }

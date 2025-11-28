import { PartialType } from '@nestjs/mapped-types';
import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  IsDateString,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from 'src/prisma/generated/client';
import { VehicleType } from 'src/vehicle/vehicle.dto';

export class CreateInstallmentDto {
  @IsUUID()
  loanId: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  gps: number;

  @IsString()
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsBoolean()
  isLate?: boolean;

  @IsOptional()
  @IsDateString()
  latePaymentDate?: string;

  @IsOptional()
  @IsBoolean()
  isAdvance?: boolean;

  @IsOptional()
  @IsDateString()
  advancePaymentDate?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @IsUUID()
  @IsOptional()
  createdById?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class FindInstallmentFiltersDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  plate?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  loanId?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isLate?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isAdvance?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAmount?: number;

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

export class UpdateInstallmentDto extends PartialType(CreateInstallmentDto) { }

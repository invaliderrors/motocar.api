import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsUUID, IsBoolean, IsNumber, Min } from 'class-validator';

export enum NewsType {
  LOAN_SPECIFIC = 'LOAN_SPECIFIC',
  STORE_WIDE = 'STORE_WIDE',
}

export enum NewsCategory {
  WORKSHOP = 'WORKSHOP',
  MAINTENANCE = 'MAINTENANCE',
  ACCIDENT = 'ACCIDENT',
  THEFT = 'THEFT',
  DAY_OFF = 'DAY_OFF',
  HOLIDAY = 'HOLIDAY',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  OTHER = 'OTHER',
}

export enum VehicleType {
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
  TRUCK = 'TRUCK',
  VAN = 'VAN',
  ATV = 'ATV',
  OTHER = 'OTHER',
}

export class CreateNewsDto {
  @IsEnum(NewsType)
  @IsNotEmpty()
  type: NewsType;

  @IsEnum(NewsCategory)
  @IsNotEmpty()
  category: NewsCategory;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // For LOAN_SPECIFIC news
  @IsUUID()
  @IsOptional()
  loanId?: string;

  // For STORE_WIDE news
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  // Vehicle type filter (for STORE_WIDE news)
  // If not provided, the news affects all vehicle types
  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  // For automatic installment calculation
  @IsBoolean()
  @IsOptional()
  autoCalculateInstallments?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  daysUnavailable?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  installmentsToSubtract?: number;
}

export class UpdateNewsDto {
  @IsEnum(NewsType)
  @IsOptional()
  type?: NewsType;

  @IsEnum(NewsCategory)
  @IsOptional()
  category?: NewsCategory;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @IsBoolean()
  @IsOptional()
  autoCalculateInstallments?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  daysUnavailable?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  installmentsToSubtract?: number;
}

export class QueryNewsDto {
  @IsEnum(NewsType)
  @IsOptional()
  type?: NewsType;

  @IsEnum(NewsCategory)
  @IsOptional()
  category?: NewsCategory;

  @IsUUID()
  @IsOptional()
  loanId?: string;

  @IsUUID()
  @IsOptional()
  storeId?: string;

  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}

import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsObject } from 'class-validator';

export enum CashFlowAccountType {
  BANK = 'BANK',
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  INVESTMENT = 'INVESTMENT',
  LOAN_RECEIVABLE = 'LOAN_RECEIVABLE',
  OTHER = 'OTHER',
}

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsEnum(CashFlowAccountType)
  accountType: CashFlowAccountType;

  @IsString()
  @IsOptional()
  currency?: string = 'COP';

  @IsNumber()
  @IsOptional()
  balance?: number = 0;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class AccountQueryDto {
  @IsEnum(CashFlowAccountType)
  @IsOptional()
  accountType?: CashFlowAccountType;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  limit?: number = 50;

  @IsString()
  @IsOptional()
  sortBy?: string = 'name';

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

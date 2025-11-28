import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
  IsDateString,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CashFlowTransactionType {
  INFLOW = 'INFLOW',
  OUTFLOW = 'OUTFLOW',
}

export enum CashFlowCategory {
  // Operating Activities
  CUSTOMER_PAYMENT = 'CUSTOMER_PAYMENT',
  VENDOR_PAYMENT = 'VENDOR_PAYMENT',
  SALARY_PAYMENT = 'SALARY_PAYMENT',
  RENT_PAYMENT = 'RENT_PAYMENT',
  UTILITIES_PAYMENT = 'UTILITIES_PAYMENT',
  TAX_PAYMENT = 'TAX_PAYMENT',
  INTEREST_PAYMENT = 'INTEREST_PAYMENT',
  SERVICE_PAYMENT = 'SERVICE_PAYMENT',
  
  // Investing Activities
  ASSET_PURCHASE = 'ASSET_PURCHASE',
  ASSET_SALE = 'ASSET_SALE',
  INVESTMENT_PURCHASE = 'INVESTMENT_PURCHASE',
  INVESTMENT_SALE = 'INVESTMENT_SALE',
  LOAN_DISBURSEMENT = 'LOAN_DISBURSEMENT',
  LOAN_REPAYMENT_RECEIVED = 'LOAN_REPAYMENT_RECEIVED',
  
  // Financing Activities
  EQUITY_INJECTION = 'EQUITY_INJECTION',
  EQUITY_WITHDRAWAL = 'EQUITY_WITHDRAWAL',
  LOAN_RECEIVED = 'LOAN_RECEIVED',
  LOAN_REPAYMENT_MADE = 'LOAN_REPAYMENT_MADE',
  DIVIDEND_PAYMENT = 'DIVIDEND_PAYMENT',
  
  // Other
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT',
  OTHER = 'OTHER',
}

export class CreateTransactionDto {
  @IsString()
  idempotencyKey: string;

  @IsString()
  accountId: string;

  @IsEnum(CashFlowTransactionType)
  type: CashFlowTransactionType;

  @IsEnum(CashFlowCategory)
  category: CashFlowCategory;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string = 'COP';

  @IsDateString()
  date: string;

  @IsString()
  @IsOptional()
  counterparty?: string;

  @IsString()
  @IsOptional()
  memo?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentUrls?: string[] = [];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateBatchTransactionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  transactions: CreateTransactionDto[];
}

export class UpdateTransactionDto {
  @IsString()
  @IsOptional()
  counterparty?: string;

  @IsString()
  @IsOptional()
  memo?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentUrls?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsEnum(CashFlowCategory)
  @IsOptional()
  category?: CashFlowCategory;
}

export class TransactionQueryDto {
  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsOptional()
  counterparty?: string;

  @IsEnum(CashFlowCategory)
  @IsOptional()
  category?: CashFlowCategory;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  amountMin?: number;

  @IsNumber()
  @IsOptional()
  amountMax?: number;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsString()
  @IsOptional()
  search?: string; // Free text search on memo, counterparty, reference

  @IsBoolean()
  @IsOptional()
  isReconciled?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  limit?: number = 50;

  @IsString()
  @IsOptional()
  sortBy?: string = 'date';

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

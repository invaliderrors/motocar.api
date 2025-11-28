import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  IsObject,
} from 'class-validator';
import { CashFlowCategory } from './transaction.dto';

export class CreateRuleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  priority?: number = 0;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  // Matching conditions
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  accountIds?: string[] = [];

  @IsString()
  @IsOptional()
  counterpartyRegex?: string;

  @IsString()
  @IsOptional()
  memoRegex?: string;

  @IsNumber()
  @IsOptional()
  amountMin?: number;

  @IsNumber()
  @IsOptional()
  amountMax?: number;

  @IsArray()
  @IsEnum(CashFlowCategory, { each: true })
  @IsOptional()
  categories?: CashFlowCategory[] = [];

  // Actions
  @IsEnum(CashFlowCategory)
  @IsOptional()
  targetCategory?: CashFlowCategory;

  @IsString()
  @IsOptional()
  targetCounterparty?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  addTags?: string[] = [];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Matching conditions
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  accountIds?: string[];

  @IsString()
  @IsOptional()
  counterpartyRegex?: string;

  @IsString()
  @IsOptional()
  memoRegex?: string;

  @IsNumber()
  @IsOptional()
  amountMin?: number;

  @IsNumber()
  @IsOptional()
  amountMax?: number;

  @IsArray()
  @IsEnum(CashFlowCategory, { each: true })
  @IsOptional()
  categories?: CashFlowCategory[];

  // Actions
  @IsEnum(CashFlowCategory)
  @IsOptional()
  targetCategory?: CashFlowCategory;

  @IsString()
  @IsOptional()
  targetCounterparty?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  addTags?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class DryRunRuleDto {
  @IsString()
  ruleId: string;

  @IsArray()
  @IsString({ each: true })
  transactionIds: string[];
}

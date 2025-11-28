import { PartialType } from '@nestjs/mapped-types';
import {
  IsUUID,
  IsNumber,
  IsInt,
  IsEnum,
  Min,
  IsPositive,
  IsOptional,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { LoanStatus } from 'src/prisma/generated/client';

export enum InterestType {
  FIXED = 'FIXED',
  COMPOUND = 'COMPOUND',
}

export enum PaymentFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export class CreateLoanDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  vehicleId: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsNumber()
  @Min(0)
  downPayment: number;

  @IsInt()
  @Min(1)
  installments: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  loanTermMonths?: number;

  @IsNumber()
  @Min(0)
  interestRate: number;

  @IsEnum(InterestType)
  @IsOptional()
  interestType?: InterestType;

  @IsEnum(PaymentFrequency)
  @IsOptional()
  paymentFrequency?: PaymentFrequency;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  installmentPaymentAmmount?: number;

  @IsNumber()
  @IsPositive()
  gpsInstallmentPayment: number;

  @ValidateIf((o) => o.startDate !== null && o.startDate !== '' && o.startDate !== undefined)
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ValidateIf((o) => o.endDate !== null && o.endDate !== '' && o.endDate !== undefined)
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class UpdateLoanDto extends PartialType(CreateLoanDto) { }

export class UpdateLoanDatesDto {
  @ValidateIf((o) => o.startDate !== null && o.startDate !== '' && o.startDate !== undefined)
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ValidateIf((o) => o.endDate !== null && o.endDate !== '' && o.endDate !== undefined)
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class UpdateLoanStatusDto {
  @IsEnum(LoanStatus)
  status: LoanStatus;
}

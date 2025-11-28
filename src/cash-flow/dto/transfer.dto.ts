import { IsString, IsNumber, IsDateString, IsOptional, IsObject } from 'class-validator';

export class CreateTransferDto {
  @IsString()
  idempotencyKey: string;

  @IsString()
  fromAccountId: string;

  @IsString()
  toAccountId: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string = 'COP';

  @IsDateString()
  date: string;

  @IsString()
  @IsOptional()
  memo?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

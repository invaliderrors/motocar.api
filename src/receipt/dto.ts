import { IsString, IsNumber, IsDateString, IsOptional, IsNotEmpty, Matches, IsBoolean } from 'class-validator';

export class CreateReceiptDto {
  @IsString()
  name: string;

  @IsString()
  identification: string;

  @IsString()
  concept: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  gps: number;

  @IsNumber()
  total: number;

  @IsDateString()
  date: string;

  @IsString()
  paymentDate: string;

  @IsBoolean()
  @IsOptional()
  isLate?: boolean;

  @IsDateString()
  @IsOptional()
  latePaymentDate?: string;

  @IsBoolean()
  @IsOptional()
  isAdvance?: boolean;

  @IsDateString()
  @IsOptional()
  advancePaymentDate?: string;

  @IsString()
  receiptNumber: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  storeId?: string;

  @IsNumber()
  @IsOptional()
  paidInstallments?: number;

  @IsNumber()
  @IsOptional()
  remainingInstallments?: number;

  @IsNumber()
  @IsOptional()
  totalInstallments?: number;

  @IsNumber()
  @IsOptional()
  daysSinceLastPayment?: number;

  @IsDateString()
  @IsOptional()
  lastPaymentDate?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  contractCode?: string;

  @IsString()
  @IsOptional()
  paymentFrequency?: string;

  @IsNumber()
  @IsOptional()
  debtRemaining?: number;
}

export class SendReceiptWhatsappDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: "Phone number must be between 10 and 15 digits, optionally starting with +",
  })
  phoneNumber: string

  @IsNotEmpty()
  receipt: CreateReceiptDto

  @IsOptional()
  @IsString()
  message?: string
}

export class SendReceiptDto extends CreateReceiptDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: "Phone number must be between 10 and 15 digits, optionally starting with +",
  })
  phoneNumber: string

  @IsOptional()
  @IsString()
  caption?: string

  @IsNotEmpty()
  @IsString()
  storeId: string
}

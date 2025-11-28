import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class TransferVehicleDto {
  @IsUUID()
  @IsNotEmpty()
  targetStoreId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class TransferLoanDto {
  @IsUUID()
  @IsNotEmpty()
  targetStoreId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReassignEmployeeDto {
  @IsUUID()
  @IsNotEmpty()
  newStoreId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

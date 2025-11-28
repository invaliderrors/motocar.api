import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { StoreStatus } from 'src/prisma/generated/client';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nit: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsEnum(StoreStatus)
  @IsOptional()
  status?: StoreStatus;
}

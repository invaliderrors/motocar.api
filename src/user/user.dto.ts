import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsInt, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  identification: string;

  @IsString()
  @IsNotEmpty()
  idIssuedAt: string;

  @IsInt()
  age: number;

  @IsString()
  city: string

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  refName: string;

  @IsString()
  @IsNotEmpty()
  refID: string;

  @IsString()
  @IsNotEmpty()
  refPhone: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) { }

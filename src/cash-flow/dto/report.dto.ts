import { IsDateString, IsOptional, IsEnum, IsString, IsNumber } from 'class-validator';

export enum ReportPeriod {
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
  CUSTOM = 'CUSTOM',
}

export enum ReportFormat {
  JSON = 'JSON',
  CSV = 'CSV',
  PDF = 'PDF',
}

export enum ForecastScenario {
  BASE = 'BASE',
  BEST = 'BEST',
  WORST = 'WORST',
}

export class CashFlowStatementDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsOptional()
  currency?: string = 'COP';

  @IsEnum(ReportFormat)
  @IsOptional()
  format?: ReportFormat = ReportFormat.JSON;
}

export class ForecastDto {
  @IsNumber()
  @IsOptional()
  weeks?: number = 13;

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsEnum(ForecastScenario)
  @IsOptional()
  scenario?: ForecastScenario = ForecastScenario.BASE;

  @IsNumber()
  @IsOptional()
  scenarioDeltaPercent?: number = 10; // ±10% for best/worst
}

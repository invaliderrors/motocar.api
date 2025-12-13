import { IsString, IsEnum, IsOptional, IsNumber, Min, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { AuditAction, UserRole } from 'src/prisma/generated/client';

export class CreateAuditLogDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsUUID()
  actorId: string;

  @IsEnum(UserRole)
  actorRole: UserRole;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsString()
  entity: string;

  @IsString()
  entityId: string;

  @IsOptional()
  oldValues?: Record<string, any>;

  @IsOptional()
  newValues?: Record<string, any>;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class AuditLogFiltersDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class AuditLogStatisticsDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export interface AuditLogStatistics {
  totalLogs: number;
  actionBreakdown: {
    action: AuditAction;
    count: number;
  }[];
  entityBreakdown: {
    entity: string;
    count: number;
  }[];
  topActors: {
    actorId: string;
    actorName: string;
    count: number;
  }[];
  recentActivity: {
    date: string;
    count: number;
  }[];
}

export interface PaginatedAuditLogs {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

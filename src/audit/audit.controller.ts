import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import {
  AuditLogFiltersDto,
  AuditLogStatisticsDto,
} from './audit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserStoreId } from '../auth/decorators/store.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'src/prisma/generated/client';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/v1/audit-logs
   * Get all audit logs with filtering and pagination
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findAll(
    @Query() filters: AuditLogFiltersDto,
    @UserStoreId() userStoreId: string | null,
  ) {
    return this.auditService.findAll(filters, userStoreId);
  }

  /**
   * GET /api/v1/audit-logs/statistics
   * Get audit log statistics
   */
  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  getStatistics(
    @Query() filters: AuditLogStatisticsDto,
    @UserStoreId() userStoreId: string | null,
  ) {
    return this.auditService.getStatistics(filters, userStoreId);
  }

  /**
   * GET /api/v1/audit-logs/entity/:entity/:entityId
   * Get all logs for a specific entity
   */
  @Get('entity/:entity/:entityId')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
    @UserStoreId() userStoreId: string | null,
  ) {
    return this.auditService.findByEntity(entity, entityId, userStoreId);
  }

  /**
   * GET /api/v1/audit-logs/actor/:actorId
   * Get all actions by a specific actor
   */
  @Get('actor/:actorId')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findByActor(
    @Param('actorId') actorId: string,
    @UserStoreId() userStoreId: string | null,
  ) {
    return this.auditService.findByActor(actorId, userStoreId);
  }

  /**
   * GET /api/v1/audit-logs/:id
   * Get a single audit log by ID
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE)
  findOne(
    @Param('id') id: string,
    @UserStoreId() userStoreId: string | null,
  ) {
    return this.auditService.findOne(id, userStoreId);
  }
}

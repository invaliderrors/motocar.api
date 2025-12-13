import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAuditLogDto,
  AuditLogFiltersDto,
  AuditLogStatisticsDto,
  AuditLogStatistics,
  PaginatedAuditLogs,
} from './audit.dto';
import { AuditLog } from 'src/prisma/generated/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new audit log entry
   */
  async createAuditLog(data: CreateAuditLogDto): Promise<AuditLog> {
    try {
      return await this.prisma.auditLog.create({
        data: {
          storeId: data.storeId || null,
          actorId: data.actorId,
          actorRole: data.actorRole,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          oldValues: data.oldValues ? JSON.parse(JSON.stringify(data.oldValues)) : undefined,
          newValues: data.newValues ? JSON.parse(JSON.stringify(data.newValues)) : undefined,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to create audit log:', error);
      throw error;
    }
  }

  /**
   * Find all audit logs with filtering and pagination
   */
  async findAll(filters: AuditLogFiltersDto, userStoreId: string | null): Promise<PaginatedAuditLogs> {
    const {
      storeId,
      actorId,
      action,
      entity,
      entityId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    // Build where clause
    const where: any = {};

    // Store filtering: admins can see all stores, employees only their store
    if (userStoreId) {
      where.storeId = userStoreId;
    } else if (storeId) {
      where.storeId = storeId;
    }

    if (actorId) where.actorId = actorId;
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;

    // Date range filtering
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async findByEntity(entity: string, entityId: string, userStoreId: string | null): Promise<AuditLog[]> {
    const where: any = { entity, entityId };
    
    // Apply store filtering
    if (userStoreId) {
      where.storeId = userStoreId;
    }

    return await this.prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get audit logs by actor (employee)
   */
  async findByActor(actorId: string, userStoreId: string | null): Promise<AuditLog[]> {
    const where: any = { actorId };
    
    // Apply store filtering
    if (userStoreId) {
      where.storeId = userStoreId;
    }

    return await this.prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to last 100 actions
    });
  }

  /**
   * Get audit logs by store
   */
  async findByStore(storeId: string): Promise<AuditLog[]> {
    return await this.prisma.auditLog.findMany({
      where: { storeId },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  /**
   * Get a single audit log by ID
   */
  async findOne(id: string, userStoreId: string | null): Promise<AuditLog> {
    const where: any = { id };
    
    // Apply store filtering
    if (userStoreId) {
      where.storeId = userStoreId;
    }

    const auditLog = await this.prisma.auditLog.findFirst({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!auditLog) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }

    return auditLog;
  }

  /**
   * Get statistics for audit logs
   */
  async getStatistics(filters: AuditLogStatisticsDto, userStoreId: string | null): Promise<AuditLogStatistics> {
    const { storeId, startDate, endDate } = filters;

    // Build where clause
    const where: any = {};

    // Store filtering
    if (userStoreId) {
      where.storeId = userStoreId;
    } else if (storeId) {
      where.storeId = storeId;
    }

    // Date range filtering
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Get total count
    const totalLogs = await this.prisma.auditLog.count({ where });

    // Get action breakdown
    const actionBreakdown = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: {
        action: true,
      },
    });

    // Get entity breakdown
    const entityBreakdown = await this.prisma.auditLog.groupBy({
      by: ['entity'],
      where,
      _count: {
        entity: true,
      },
      orderBy: {
        _count: {
          entity: 'desc',
        },
      },
      take: 10,
    });

    // Get top actors
    const topActorsRaw = await this.prisma.auditLog.groupBy({
      by: ['actorId'],
      where,
      _count: {
        actorId: true,
      },
      orderBy: {
        _count: {
          actorId: 'desc',
        },
      },
      take: 10,
    });

    // Fetch actor details
    const actorIds = topActorsRaw.map((a) => a.actorId);
    const actors = await this.prisma.employee.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true },
    });

    const topActors = topActorsRaw.map((a) => {
      const actor = actors.find((ac) => ac.id === a.actorId);
      return {
        actorId: a.actorId,
        actorName: actor?.name || 'Unknown',
        count: a._count.actorId,
      };
    });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let recentActivityRaw: { date: Date; count: bigint }[];
    
    if (userStoreId) {
      recentActivityRaw = await this.prisma.$queryRaw<
        { date: Date; count: bigint }[]
      >`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM "AuditLog"
        WHERE created_at >= ${sevenDaysAgo} AND store_id = ${userStoreId}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
    } else {
      recentActivityRaw = await this.prisma.$queryRaw<
        { date: Date; count: bigint }[]
      >`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM "AuditLog"
        WHERE created_at >= ${sevenDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
    }

    const recentActivity = recentActivityRaw.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      count: Number(r.count),
    }));

    return {
      totalLogs,
      actionBreakdown: actionBreakdown.map((a) => ({
        action: a.action,
        count: a._count.action,
      })),
      entityBreakdown: entityBreakdown.map((e) => ({
        entity: e.entity,
        count: e._count.entity,
      })),
      topActors,
      recentActivity,
    };
  }
}

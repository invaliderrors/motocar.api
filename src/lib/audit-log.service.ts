import { Injectable } from '@nestjs/common';
import { AuditAction, UserRole } from 'src/prisma/generated/client';
import { PrismaService } from 'src/prisma/prisma.service';

export interface AuditLogData {
  storeId: string | null;
  actorId: string;
  actorRole: UserRole;
  action: AuditAction;
  entity: string;
  entityId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry
   */
  async log(data: AuditLogData) {
    return this.prisma.auditLog.create({
      data: {
        storeId: data.storeId,
        actorId: data.actorId,
        actorRole: data.actorRole,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        oldValues: data.oldValues || undefined,
        newValues: data.newValues || undefined,
        metadata: data.metadata || undefined,
        ipAddress: data.ipAddress || undefined,
        userAgent: data.userAgent || undefined,
      },
    });
  }

  /**
   * Get audit logs with optional filtering
   */
  async findAll(params: {
    storeId?: string | null;
    actorId?: string;
    action?: AuditAction;
    entity?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};

    if (params.storeId !== undefined) {
      where.storeId = params.storeId;
    }
    if (params.actorId) where.actorId = params.actorId;
    if (params.action) where.action = params.action;
    if (params.entity) where.entity = params.entity;
    if (params.entityId) where.entityId = params.entityId;
    
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              username: true,
              role: true,
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
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get audit trail for a specific entity
   */
  async getEntityHistory(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        entity,
        entityId,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

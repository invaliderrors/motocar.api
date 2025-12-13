import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AppLoggerService } from '../logger/logger.service';
import { AuditService } from '../../audit/audit.service';
import {
  LOG_ACTION_KEY,
  LogActionMetadata,
  ActionType,
} from '../decorators/log-action.decorator';
import { AuditAction } from 'src/prisma/generated/client';

@Injectable()
export class ActionLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLoggerService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Map ActionType to AuditAction enum
   */
  private mapActionToAuditAction(action: ActionType): AuditAction {
    const mapping: Record<ActionType, AuditAction> = {
      [ActionType.CREATE]: AuditAction.CREATE,
      [ActionType.UPDATE]: AuditAction.UPDATE,
      [ActionType.DELETE]: AuditAction.DELETE,
      [ActionType.ARCHIVE]: AuditAction.ARCHIVE,
      [ActionType.RESTORE]: AuditAction.RESTORE,
      [ActionType.QUERY]: AuditAction.VIEW_SENSITIVE, // Map QUERY to VIEW_SENSITIVE
      [ActionType.EXPORT]: AuditAction.EXPORT,
      [ActionType.IMPORT]: AuditAction.CREATE, // Map IMPORT to CREATE
      [ActionType.CUSTOM]: AuditAction.UPDATE, // Map CUSTOM to UPDATE
    };
    return mapping[action] || AuditAction.UPDATE;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const logMetadata = this.reflector.get<LogActionMetadata>(
      LOG_ACTION_KEY,
      context.getHandler(),
    );

    if (!logMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { action, entity, description } = logMetadata;
    const user = request.user;
    
    console.log('🎯 ActionLoggingInterceptor triggered:', { 
      action, 
      entity, 
      user: user ? Object.keys(user) : 'no user',
      userId: user?.id,
      userSub: user?.sub
    });

    const metadata = {
      userId: user?.id || user?.sub,
      userName: user?.email || user?.username,
      ip: request.ip,
    };

    // Set context for this operation
    this.logger.setContext(`${entity}Controller`);

    return next.handle().pipe(
      tap(async (data) => {
        // Extract ID from response or params
        const entityId = data?.id || request.params?.id || 'N/A';

        // Log to console (existing behavior)
        switch (action) {
          case ActionType.CREATE:
            this.logger.logCreate(entity, entityId, metadata);
            break;
          case ActionType.UPDATE:
            this.logger.logUpdate(entity, entityId, metadata);
            break;
          case ActionType.DELETE:
            this.logger.logDelete(entity, entityId, metadata);
            break;
          case ActionType.ARCHIVE:
            this.logger.logArchive(entity, entityId, metadata);
            break;
          case ActionType.RESTORE:
            this.logger.logRestore(entity, entityId, metadata);
            break;
          case ActionType.QUERY:
            this.logger.logQuery(entity, request.query, metadata);
            break;
          case ActionType.EXPORT:
            this.logger.logExport(
              entity,
              request.params?.format || 'unknown',
              metadata,
            );
            break;
          case ActionType.CUSTOM:
            this.logger.logBusinessOperation(
              description || 'Custom action',
              { entity, id: entityId },
              metadata,
            );
            break;
          default:
            this.logger.log(
              `Action: ${action} on ${entity} [${entityId}]`,
              metadata,
            );
        }

        // Persist to database (new behavior)
        // Skip QUERY actions to avoid cluttering the audit log
        const userId = user?.sub || user?.id; // JWT uses 'sub' for user ID
        if (action !== ActionType.QUERY && userId) {
          try {
            // Use request.userStoreId set by StoreAccessGuard instead of user.storeId
            const storeId = request.userStoreId !== undefined ? request.userStoreId : (user.storeId || null);
            
            const auditData = {
              storeId,
              actorId: userId,
              actorRole: user.role,
              action: this.mapActionToAuditAction(action),
              entity,
              entityId,
              oldValues: request.body?._oldValues || null, // Will be populated by services
              newValues: action !== ActionType.DELETE ? data : null,
              metadata: {
                description,
                method: request.method,
                url: request.url,
                ...(action === ActionType.CUSTOM ? { customAction: description } : {}),
              },
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
            };
            
            console.log('📝 Creating audit log:', {
              action: auditData.action,
              entity: auditData.entity,
              entityId: auditData.entityId,
              actorId: auditData.actorId,
              storeId: auditData.storeId,
            });
            
            const auditLog = await this.auditService.createAuditLog(auditData);
            console.log('✅ Audit log created with ID:', auditLog.id);
          } catch (error) {
            // Don't fail the request if audit logging fails
            console.error('❌ Failed to persist audit log to database:', error);
            this.logger.error('Failed to persist audit log to database', error);
          }
        }
      }),
    );
  }
}

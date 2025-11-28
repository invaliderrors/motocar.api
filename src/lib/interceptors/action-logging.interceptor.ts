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
import {
  LOG_ACTION_KEY,
  LogActionMetadata,
  ActionType,
} from '../decorators/log-action.decorator';

@Injectable()
export class ActionLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: AppLoggerService,
  ) {}

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

    const metadata = {
      userId: user?.id || user?.sub,
      userName: user?.email || user?.username,
      ip: request.ip,
    };

    // Set context for this operation
    this.logger.setContext(`${entity}Controller`);

    return next.handle().pipe(
      tap((data) => {
        // Extract ID from response or params
        const id = data?.id || request.params?.id || 'N/A';

        switch (action) {
          case ActionType.CREATE:
            this.logger.logCreate(entity, id, metadata);
            break;
          case ActionType.UPDATE:
            this.logger.logUpdate(entity, id, metadata);
            break;
          case ActionType.DELETE:
            this.logger.logDelete(entity, id, metadata);
            break;
          case ActionType.ARCHIVE:
            this.logger.logArchive(entity, id, metadata);
            break;
          case ActionType.RESTORE:
            this.logger.logRestore(entity, id, metadata);
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
              { entity, id },
              metadata,
            );
            break;
          default:
            this.logger.log(
              `Action: ${action} on ${entity} [${id}]`,
              metadata,
            );
        }
      }),
    );
  }
}

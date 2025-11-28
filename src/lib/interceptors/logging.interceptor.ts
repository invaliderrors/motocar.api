import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AppLoggerService } from '../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, ip, body, query, params } = request;
    const userAgent = request.get('user-agent') || '';
    const user = request.user;

    const startTime = Date.now();

    // Generate correlation ID
    const correlationId = request.headers['x-correlation-id'] || 
                         `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const metadata = {
      correlationId,
      userId: user?.id || user?.sub,
      ip,
      userAgent,
    };

    // Log incoming request
    const requestInfo = {
      ...metadata,
      ...(query && Object.keys(query).length > 0 && { query }),
      ...(params && Object.keys(params).length > 0 && { params }),
      ...(body && Object.keys(body).length > 0 && { bodyKeys: Object.keys(body) }),
    };

    this.logger.logRequest(method, url, requestInfo);

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log successful response
        this.logger.logResponse(method, url, statusCode, duration, {
          ...metadata,
          responseType: typeof data,
          ...(Array.isArray(data) && { resultCount: data.length }),
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log error response
        this.logger.error(
          `✗ ${method} ${url} ${statusCode} (${duration}ms)`,
          error.stack,
          {
            ...metadata,
            errorName: error.name,
            errorMessage: error.message,
          },
        );

        throw error;
      }),
    );
  }
}

import { Injectable, Logger, LoggerService, Scope } from '@nestjs/common';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export interface LogMetadata {
  userId?: string;
  correlationId?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private context?: string;
  private readonly logger = new Logger();

  setContext(context: string) {
    this.context = context;
  }

  private formatMessage(message: string, metadata?: LogMetadata): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return message;
    }

    const metaString = Object.entries(metadata)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(' ');

    return `${message} | ${metaString}`;
  }

  log(message: string, metadata?: LogMetadata) {
    this.logger.log(this.formatMessage(message, metadata), this.context);
  }

  error(message: string, trace?: string, metadata?: LogMetadata) {
    this.logger.error(
      this.formatMessage(message, metadata),
      trace,
      this.context,
    );
  }

  warn(message: string, metadata?: LogMetadata) {
    this.logger.warn(this.formatMessage(message, metadata), this.context);
  }

  debug(message: string, metadata?: LogMetadata) {
    this.logger.debug(this.formatMessage(message, metadata), this.context);
  }

  verbose(message: string, metadata?: LogMetadata) {
    this.logger.verbose(this.formatMessage(message, metadata), this.context);
  }

  // Action-specific logging methods
  logRequest(method: string, url: string, metadata?: LogMetadata) {
    this.log(`→ ${method} ${url}`, metadata);
  }

  logResponse(method: string, url: string, statusCode: number, duration: number, metadata?: LogMetadata) {
    this.log(`← ${method} ${url} ${statusCode} (${duration}ms)`, metadata);
  }

  logCreate(entity: string, id: string, metadata?: LogMetadata) {
    this.log(`✓ Created ${entity} [${id}]`, metadata);
  }

  logUpdate(entity: string, id: string, metadata?: LogMetadata) {
    this.log(`✓ Updated ${entity} [${id}]`, metadata);
  }

  logDelete(entity: string, id: string, metadata?: LogMetadata) {
    this.log(`✓ Deleted ${entity} [${id}]`, metadata);
  }

  logArchive(entity: string, id: string, metadata?: LogMetadata) {
    this.log(`✓ Archived ${entity} [${id}]`, metadata);
  }

  logRestore(entity: string, id: string, metadata?: LogMetadata) {
    this.log(`✓ Restored ${entity} [${id}]`, metadata);
  }

  logQuery(entity: string, filters?: any, metadata?: LogMetadata) {
    const filterInfo = filters ? ` with filters: ${JSON.stringify(filters)}` : '';
    this.log(`→ Query ${entity}${filterInfo}`, metadata);
  }

  logExport(entity: string, format: string, metadata?: LogMetadata) {
    this.log(`→ Export ${entity} as ${format}`, metadata);
  }

  logAuth(action: string, metadata?: LogMetadata) {
    this.log(`🔐 Auth: ${action}`, metadata);
  }

  logBusinessOperation(operation: string, details?: any, metadata?: LogMetadata) {
    const detailsInfo = details ? ` | ${JSON.stringify(details)}` : '';
    this.log(`⚙️ ${operation}${detailsInfo}`, metadata);
  }
}

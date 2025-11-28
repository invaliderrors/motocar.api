import { SetMetadata } from '@nestjs/common';

export enum ActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ARCHIVE = 'ARCHIVE',
  RESTORE = 'RESTORE',
  QUERY = 'QUERY',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  CUSTOM = 'CUSTOM',
}

export interface LogActionMetadata {
  action: ActionType;
  entity: string;
  description?: string;
}

export const LOG_ACTION_KEY = 'log_action';

/**
 * Decorator to mark methods that should be logged with specific action types
 * @param action - The type of action being performed
 * @param entity - The entity being acted upon (e.g., 'Loan', 'User', 'Vehicle')
 * @param description - Optional description of the action
 */
export const LogAction = (
  action: ActionType,
  entity: string,
  description?: string,
) => SetMetadata(LOG_ACTION_KEY, { action, entity, description });

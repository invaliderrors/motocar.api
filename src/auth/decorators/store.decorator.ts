import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract storeId from request
 * Returns null for ADMIN users (access to all stores)
 * Returns storeId for EMPLOYEE users (scoped to their store)
 */
export const UserStoreId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.userStoreId ?? null;
  },
);

/**
 * Decorator to check if current user is an admin
 */
export const IsAdmin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): boolean => {
    const request = ctx.switchToHttp().getRequest();
    return request.isAdmin ?? false;
  },
);

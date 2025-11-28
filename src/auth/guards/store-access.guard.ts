import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/prisma/generated/client';

export const SKIP_STORE_CHECK_KEY = 'skipStoreCheck';

/**
 * StoreAccessGuard ensures that:
 * 1. ADMIN users can access all stores (bypass check)
 * 2. EMPLOYEE users can only access data from their assigned store
 * 3. Adds storeId to request object for use in services
 */
@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Check if this route should skip store checking
    const skipStoreCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_STORE_CHECK_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (skipStoreCheck) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // ADMIN has access to all stores
    if (user.role === UserRole.ADMIN) {
      // Check if admin is viewing a specific store (from header or query)
      const selectedStoreId = request.headers['x-store-id'] || request.query.storeId;
      
      if (selectedStoreId) {
        // Admin is viewing as a specific store
        console.log('🔐 StoreAccessGuard - ADMIN viewing specific store:', selectedStoreId);
        request.userStoreId = selectedStoreId;
        request.isAdmin = true;
        request.isAdminViewingAsStore = true;
      } else {
        // Admin viewing all stores
        console.log('🔐 StoreAccessGuard - ADMIN viewing all stores (userStoreId: null)');
        request.userStoreId = null; // null means access to all stores
        request.isAdmin = true;
        request.isAdminViewingAsStore = false;
      }
      return true;
    }

    // EMPLOYEE must have a storeId
    if (user.role === UserRole.EMPLOYEE) {
      if (!user.storeId) {
        throw new ForbiddenException('Employee must be assigned to a store');
      }
      
      console.log('🔐 StoreAccessGuard - EMPLOYEE detected, setting userStoreId:', user.storeId);
      request.userStoreId = user.storeId;
      request.isAdmin = false;
      return true;
    }

    throw new ForbiddenException('Invalid user role');
  }
}

import { PrismaService } from 'src/prisma/prisma.service';

/**
 * BaseStoreService - Abstract base class for store-scoped services
 * 
 * Provides helper methods to automatically filter queries by store:
 * - ADMIN users (storeId = null): No filtering, access all data
 * - EMPLOYEE users (storeId = string): Filter by their assigned store
 * 
 * Usage:
 * ```typescript
 * @Injectable()
 * export class MyService extends BaseStoreService {
 *   constructor(prisma: PrismaService) {
 *     super(prisma);
 *   }
 * 
 *   async findAll(userStoreId: string | null) {
 *     return this.prisma.myModel.findMany({
 *       where: this.storeFilter(userStoreId),
 *     });
 *   }
 * }
 * ```
 */
export abstract class BaseStoreService {
  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Returns a Prisma where clause that filters by storeId
   * @param userStoreId - null for ADMIN (no filter), storeId for EMPLOYEE
   * @returns Prisma where clause object
   */
  protected storeFilter(userStoreId: string | null): { storeId?: string } {
    // ADMIN: no filter (access all stores)
    if (userStoreId === null) {
      return {};
    }
    
    // EMPLOYEE: filter by their store
    return { storeId: userStoreId };
  }

  /**
   * Validates that an entity belongs to the user's store (for EMPLOYEE)
   * @param entity - The entity to check
   * @param userStoreId - null for ADMIN (skip check), storeId for EMPLOYEE
   * @throws ForbiddenException if entity doesn't belong to user's store
   */
  protected validateStoreAccess(
    entity: { storeId: string } | null,
    userStoreId: string | null,
  ): void {
    // ADMIN: skip validation
    if (userStoreId === null) {
      return;
    }

    // Entity not found
    if (!entity) {
      throw new Error('Entity not found');
    }

    // EMPLOYEE: must match their store
    if (entity.storeId !== userStoreId) {
      throw new Error('Access denied: Entity belongs to a different store');
    }
  }

  /**
   * Ensures that data being created has the correct storeId
   * @param userStoreId - null for ADMIN (must provide storeId), storeId for EMPLOYEE (auto-set)
   * @param providedStoreId - Optional storeId provided in the request
   * @returns The storeId to use for the new entity
   */
  protected getStoreIdForCreate(
    userStoreId: string | null,
    providedStoreId?: string,
  ): string {
    // EMPLOYEE: always use their storeId
    if (userStoreId !== null) {
      return userStoreId;
    }

    // ADMIN: must provide a storeId
    if (!providedStoreId) {
      throw new Error('ADMIN must specify a storeId when creating entities');
    }

    return providedStoreId;
  }
}

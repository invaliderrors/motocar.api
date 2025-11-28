import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Resource,
  Action,
  PermissionsMap,
  DEFAULT_PERMISSIONS,
  getAllPermissions,
  PermissionCheck,
} from './permissions.types';
import { UserRole } from 'src/prisma/generated/client';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all available permissions (hardcoded)
   */
  getAllPermissions(): PermissionCheck[] {
    return getAllPermissions();
  }

  /**
   * Get permissions grouped by resource
   */
  getPermissionsGroupedByResource(): Record<Resource, Action[]> {
    const grouped: Record<string, Action[]> = {};
    
    for (const resource of Object.values(Resource)) {
      grouped[resource] = Object.values(Action);
    }
    
    return grouped as Record<Resource, Action[]>;
  }

  /**
   * Get default permissions for a role
   */
  getDefaultPermissionsForRole(role: UserRole): PermissionsMap {
    return DEFAULT_PERMISSIONS[role] || {};
  }

  /**
   * Get owner's permissions
   */
  async getOwnerPermissions(ownerId: string) {
    const owner = await this.prisma.employee.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        permissions: true,
      },
    });

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${ownerId} not found`);
    }

    // If owner is ADMIN, they have all permissions
    if (owner.role === UserRole.ADMIN) {
      return {
        owner: {
          id: owner.id,
          name: owner.name,
          username: owner.username,
          role: owner.role,
        },
        permissions: DEFAULT_PERMISSIONS[UserRole.ADMIN],
        isAdmin: true,
      };
    }

    // Parse permissions from JSON field
    const permissions = owner.permissions as PermissionsMap || {};

    return {
      owner: {
        id: owner.id,
        name: owner.name,
        username: owner.username,
        role: owner.role,
      },
      permissions,
      isAdmin: false,
    };
  }

  /**
   * Set owner's permissions (replace all)
   */
  async setOwnerPermissions(
    ownerId: string,
    permissions: PermissionsMap,
    updatedBy: string,
  ) {
    // Verify owner exists
    const owner = await this.prisma.employee.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${ownerId} not found`);
    }

    // Validate permissions
    this.validatePermissions(permissions);

    // Update owner's permissions
    const updated = await this.prisma.employee.update({
      where: { id: ownerId },
      data: {
        permissions: permissions as any,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        permissions: true,
      },
    });

    return {
      message: 'Owner permissions updated successfully',
      owner: {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        role: updated.role,
      },
      permissions: updated.permissions,
      updatedBy,
    };
  }

  /**
   * Grant specific permission to owner
   */
  async grantPermission(
    ownerId: string,
    resource: Resource,
    action: Action,
    grantedBy: string,
  ) {
    const owner = await this.prisma.employee.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, permissions: true },
    });

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${ownerId} not found`);
    }

    const currentPermissions = (owner.permissions as PermissionsMap) || {};

    // Add the permission
    if (!currentPermissions[resource]) {
      currentPermissions[resource] = [];
    }

    if (!currentPermissions[resource]!.includes(action)) {
      currentPermissions[resource]!.push(action);
    }

    await this.prisma.employee.update({
      where: { id: ownerId },
      data: {
        permissions: currentPermissions as any,
        updatedAt: new Date(),
      },
    });

    return {
      message: `Permission ${resource}:${action} granted successfully`,
      ownerId,
      resource,
      action,
      grantedBy,
    };
  }

  /**
   * Revoke specific permission from owner
   */
  async revokePermission(
    ownerId: string,
    resource: Resource,
    action: Action,
  ) {
    const owner = await this.prisma.employee.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, permissions: true },
    });

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${ownerId} not found`);
    }

    const currentPermissions = (owner.permissions as PermissionsMap) || {};

    // Remove the permission
    if (currentPermissions[resource]) {
      currentPermissions[resource] = currentPermissions[resource]!.filter(
        (a) => a !== action,
      );

      // Remove resource key if no actions left
      if (currentPermissions[resource]!.length === 0) {
        delete currentPermissions[resource];
      }
    }

    await this.prisma.employee.update({
      where: { id: ownerId },
      data: {
        permissions: currentPermissions as any,
        updatedAt: new Date(),
      },
    });

    return {
      message: `Permission ${resource}:${action} revoked successfully`,
      ownerId,
      resource,
      action,
    };
  }

  /**
   * Grant resource-level permissions (all actions for a resource)
   */
  async grantResourcePermissions(
    ownerId: string,
    resource: Resource,
    actions: Action[],
    grantedBy: string,
  ) {
    const owner = await this.prisma.employee.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, permissions: true },
    });

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${ownerId} not found`);
    }

    const currentPermissions = (owner.permissions as PermissionsMap) || {};

    // Set the permissions for this resource
    currentPermissions[resource] = actions;

    await this.prisma.employee.update({
      where: { id: ownerId },
      data: {
        permissions: currentPermissions as any,
        updatedAt: new Date(),
      },
    });

    return {
      message: `Permissions for ${resource} updated successfully`,
      ownerId,
      resource,
      actions,
      grantedBy,
    };
  }

  /**
   * Check if owner has specific permission
   */
  async hasPermission(
    ownerId: string,
    resource: Resource,
    action: Action,
  ): Promise<boolean> {
    const owner = await this.prisma.employee.findUnique({
      where: { id: ownerId },
      select: { role: true, permissions: true },
    });

    if (!owner) {
      return false;
    }

    // ADMIN role has all permissions
    if (owner.role === UserRole.ADMIN) {
      return true;
    }

    const permissions = (owner.permissions as PermissionsMap) || {};

    return permissions[resource]?.includes(action) || false;
  }

  /**
   * Check if owner has any of the specified permissions
   */
  async hasAnyPermission(
    ownerId: string,
    checks: PermissionCheck[],
  ): Promise<boolean> {
    for (const check of checks) {
      if (await this.hasPermission(ownerId, check.resource, check.action)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if owner has all of the specified permissions
   */
  async hasAllPermissions(
    ownerId: string,
    checks: PermissionCheck[],
  ): Promise<boolean> {
    for (const check of checks) {
      if (!(await this.hasPermission(ownerId, check.resource, check.action))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Apply default permissions based on role
   */
  async applyRolePermissions(ownerId: string, role: UserRole) {
    const owner = await this.prisma.employee.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${ownerId} not found`);
    }

    const defaultPermissions = this.getDefaultPermissionsForRole(role);

    await this.prisma.employee.update({
      where: { id: ownerId },
      data: {
        permissions: defaultPermissions as any,
        updatedAt: new Date(),
      },
    });

    return {
      message: `Default ${role} permissions applied successfully`,
      ownerId,
      role,
      permissions: defaultPermissions,
    };
  }

  /**
   * Validate permissions structure
   */
  private validatePermissions(permissions: PermissionsMap): void {
    const validResources = Object.values(Resource);
    const validActions = Object.values(Action);

    for (const [resource, actions] of Object.entries(permissions)) {
      if (!validResources.includes(resource as Resource)) {
        throw new BadRequestException(`Invalid resource: ${resource}`);
      }

      if (!Array.isArray(actions)) {
        throw new BadRequestException(
          `Actions for ${resource} must be an array`,
        );
      }

      for (const action of actions) {
        if (!validActions.includes(action as Action)) {
          throw new BadRequestException(
            `Invalid action: ${action} for resource: ${resource}`,
          );
        }
      }
    }
  }

  /**
   * Clear all permissions for an owner
   */
  async clearOwnerPermissions(ownerId: string) {
    const owner = await this.prisma.employee.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${ownerId} not found`);
    }

    await this.prisma.employee.update({
      where: { id: ownerId },
      data: {
        permissions: {},
        updatedAt: new Date(),
      },
    });

    return {
      message: 'Owner permissions cleared successfully',
      ownerId,
    };
  }
}

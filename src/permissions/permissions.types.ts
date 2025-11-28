import { UserRole } from "src/prisma/generated/client";


export enum Resource {
  CLOSING = 'CLOSING',
  INSTALLMENT = 'INSTALLMENT',
  VEHICLE = 'VEHICLE',
  USER = 'USER',
  LOAN = 'LOAN',
  EXPENSE = 'EXPENSE',
  OWNER = 'OWNER',
  PROVIDER = 'PROVIDER',
  CASH_FLOW = 'CASH_FLOW',
  REPORT = 'REPORT',
  DASHBOARD = 'DASHBOARD',
  CONTRACT = 'CONTRACT',
  RECEIPT = 'RECEIPT',
}

export enum Action {
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  EXPORT = 'EXPORT',
  MANAGE = 'MANAGE',
}

export interface PermissionCheck {
  resource: Resource;
  action: Action;
}

export type PermissionsMap = {
  [key in Resource]?: Action[];
};

// Default permission sets for common roles
export const DEFAULT_PERMISSIONS: Record<UserRole, PermissionsMap> = {
  [UserRole.ADMIN]: {
    [Resource.CLOSING]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.APPROVE, Action.EXPORT],
    [Resource.INSTALLMENT]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.EXPORT],
    [Resource.VEHICLE]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.USER]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.LOAN]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.APPROVE],
    [Resource.EXPENSE]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.EXPORT],
    [Resource.OWNER]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.MANAGE],
    [Resource.PROVIDER]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.CASH_FLOW]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.EXPORT],
    [Resource.REPORT]: [Action.VIEW, Action.EXPORT],
    [Resource.DASHBOARD]: [Action.VIEW],
    [Resource.CONTRACT]: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.EXPORT],
    [Resource.RECEIPT]: [Action.VIEW, Action.CREATE, Action.EXPORT],
  } as PermissionsMap,
  
  // EMPLOYEE permissions (formerly MODERATOR + USER combined)
  [UserRole.EMPLOYEE]: {
    [Resource.CLOSING]: [Action.VIEW, Action.CREATE],
    [Resource.INSTALLMENT]: [Action.VIEW, Action.CREATE, Action.EDIT],
    [Resource.VEHICLE]: [Action.VIEW],
    [Resource.USER]: [Action.VIEW],
    [Resource.LOAN]: [Action.VIEW, Action.CREATE, Action.EDIT],
    [Resource.EXPENSE]: [Action.VIEW, Action.CREATE, Action.EDIT],
    [Resource.PROVIDER]: [Action.VIEW],
    [Resource.CASH_FLOW]: [Action.VIEW, Action.CREATE],
    [Resource.REPORT]: [Action.VIEW],
    [Resource.DASHBOARD]: [Action.VIEW],
    [Resource.CONTRACT]: [Action.VIEW],
    [Resource.RECEIPT]: [Action.VIEW, Action.CREATE],
  } as PermissionsMap,
};

// Helper function to get all available permissions
export function getAllPermissions(): PermissionCheck[] {
  const permissions: PermissionCheck[] = [];
  for (const resource of Object.values(Resource)) {
    for (const action of Object.values(Action)) {
      permissions.push({ resource, action });
    }
  }
  return permissions;
}

// Helper function to format permissions for display
export function formatPermissions(permissions: PermissionsMap): string[] {
  const formatted: string[] = [];
  for (const [resource, actions] of Object.entries(permissions)) {
    for (const action of actions) {
      formatted.push(`${resource}:${action}`);
    }
  }
  return formatted;
}

// Helper function to parse permissions from string array
export function parsePermissions(permissionStrings: string[]): PermissionsMap {
  const permissions: PermissionsMap = {};
  for (const permStr of permissionStrings) {
    const [resource, action] = permStr.split(':');
    if (resource && action) {
      if (!permissions[resource as Resource]) {
        permissions[resource as Resource] = [];
      }
      permissions[resource as Resource]!.push(action as Action);
    }
  }
  return permissions;
}

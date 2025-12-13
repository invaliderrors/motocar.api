import { UserRole } from "src/prisma/generated/client";


export enum Resource {
  CLOSING = 'CLOSING',           // Cierre de caja
  DASHBOARD = 'DASHBOARD',       // Dashboard
  EXPENSE = 'EXPENSE',           // Egresos
  INSTALLMENT = 'INSTALLMENT',   // Cuotas
  CONTRACT = 'CONTRACT',         // Contratos
  NEWS = 'NEWS',                 // Novedades
  PROVIDER = 'PROVIDER',         // Proveedores
  REPORT = 'REPORT',             // Reportes
  VEHICLE = 'VEHICLE',           // Vehículos
  USER = 'USER',                 // Usuarios
  AUDIT_LOG = 'AUDIT_LOG',       // Registros de Auditoría
}

export enum Action {
  VIEW = 'VIEW',     // For read-only modules like Dashboard and Reports
  CREATE = 'CREATE',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
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
    [Resource.CLOSING]: [Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.DASHBOARD]: [Action.VIEW],  // Dashboard is read-only
    [Resource.EXPENSE]: [Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.INSTALLMENT]: [Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.CONTRACT]: [Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.NEWS]: [Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.PROVIDER]: [Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.REPORT]: [Action.VIEW],  // Reports are read-only
    [Resource.VEHICLE]: [Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.USER]: [Action.CREATE, Action.EDIT, Action.DELETE],
    [Resource.AUDIT_LOG]: [Action.VIEW],  // Audit logs are read-only
  } as PermissionsMap,
  
  // EMPLOYEE permissions - no default permissions, must be explicitly granted
  [UserRole.EMPLOYEE]: {} as PermissionsMap,
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

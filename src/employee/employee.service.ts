import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { PermissionsMap, DEFAULT_PERMISSIONS } from '../permissions/permissions.types';
import { Employee, UserRole } from 'src/prisma/generated/client';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) { }

  async list() {
    return this.prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        storeId: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        lastAccess: true,
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async create(data: CreateEmployeeDto): Promise<Employee> {
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Validate store assignment for EMPLOYEE role
    if (data.role === UserRole.EMPLOYEE && !data.storeId) {
      throw new BadRequestException('EMPLOYEE users must be assigned to a store');
    }

    // ADMIN users should not have a store
    if (data.role === UserRole.ADMIN && data.storeId) {
      throw new BadRequestException('ADMIN users cannot be assigned to a store');
    }

    // Get default permissions based on role
    const defaultPermissions = data.role
      ? DEFAULT_PERMISSIONS[data.role]
      : DEFAULT_PERMISSIONS[UserRole.EMPLOYEE];

    return this.prisma.employee.create({
      data: {
        name: data.name,
        username: data.username,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: data.role || UserRole.EMPLOYEE,
        storeId: data.storeId || null,
        permissions: data.permissions || defaultPermissions as any,
        status: data.status || 'ACTIVE',
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async findById(id: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({
      where: { id },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async findByIdWithPermissions(id: string) {
    return this.prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        storeId: true,
        permissions: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastAccess: true,
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async updateLastAccess(id: string): Promise<Employee> {
    return this.prisma.employee.update({
      where: { id },
      data: { lastAccess: new Date() },
    });
  }

  async update(id: string, data: UpdateEmployeeDto): Promise<Employee> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Employee not found');

    // Validate store assignment for role changes
    if (data.role === UserRole.EMPLOYEE && !data.storeId && !existing.storeId) {
      throw new BadRequestException('EMPLOYEE users must be assigned to a store');
    }

    if (data.role === UserRole.ADMIN && data.storeId) {
      throw new BadRequestException('ADMIN users cannot be assigned to a store');
    }

    const updatedData: any = {
      name: data.name,
      username: data.username,
      email: data.email,
      phone: data.phone,
      status: data.status,
      role: data.role,
      storeId: data.storeId,
    };

    if (data.password) {
      updatedData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    // If role is being updated, update permissions to match the new role
    if (data.role) {
      updatedData.permissions = DEFAULT_PERMISSIONS[data.role];
    }

    // If permissions are provided directly, they override the role defaults
    if (data.permissions) {
      updatedData.permissions = data.permissions;
    }

    return this.prisma.employee.update({
      where: { id },
      data: updatedData,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: string): Promise<Employee> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Employee not found');

    return this.prisma.employee.update({
      where: { id },
      data: { status },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async updatePermissions(id: string, permissions: PermissionsMap): Promise<Employee> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Employee not found');

    return this.prisma.employee.update({
      where: { id },
      data: {
        permissions: permissions as any,
        updatedAt: new Date(),
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async getEmployeePermissions(id: string): Promise<PermissionsMap> {
    const employee = await this.findById(id);
    if (!employee) throw new NotFoundException('Employee not found');

    // If employee is ADMIN, return full permissions
    if (employee.role === UserRole.ADMIN) {
      return DEFAULT_PERMISSIONS[UserRole.ADMIN];
    }

    return (employee.permissions as PermissionsMap) || {};
  }

  async delete(id: string): Promise<Employee> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Employee not found');

    return this.prisma.employee.delete({
      where: { id },
    });
  }
}

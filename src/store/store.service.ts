import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreDto, UpdateStoreDto, StoreSummaryDto } from './dto';
import { Store, StoreStatus, UserRole } from 'src/prisma/generated/client';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all stores (Admin only)
   */
  async findAll(): Promise<Store[]> {
    return this.prisma.store.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get store by ID
   */
  async findOne(id: string): Promise<Store> {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    return store;
  }

  /**
   * Create new store (Admin only)
   */
  async create(createStoreDto: CreateStoreDto): Promise<Store> {
    // Check if store code already exists
    const existingCode = await this.prisma.store.findUnique({
      where: { code: createStoreDto.code },
    });

    if (existingCode) {
      throw new BadRequestException(
        `Store with code ${createStoreDto.code} already exists`,
      );
    }

    // Check if NIT already exists
    const existingNit = await this.prisma.store.findUnique({
      where: { nit: createStoreDto.nit },
    });

    if (existingNit) {
      throw new BadRequestException(
        `Store with NIT ${createStoreDto.nit} already exists`,
      );
    }

    return this.prisma.store.create({
      data: {
        ...createStoreDto,
        status: createStoreDto.status || StoreStatus.ACTIVE,
      },
    });
  }

  /**
   * Update store (Admin only)
   */
  async update(id: string, updateStoreDto: UpdateStoreDto): Promise<Store> {
    // Check if store exists
    await this.findOne(id);

    // If updating code, check uniqueness
    if (updateStoreDto.code) {
      const existingCode = await this.prisma.store.findFirst({
        where: {
          code: updateStoreDto.code,
          NOT: { id },
        },
      });

      if (existingCode) {
        throw new BadRequestException(
          `Store with code ${updateStoreDto.code} already exists`,
        );
      }
    }

    // If updating NIT, check uniqueness
    if (updateStoreDto.nit) {
      const existingNit = await this.prisma.store.findFirst({
        where: {
          nit: updateStoreDto.nit,
          NOT: { id },
        },
      });

      if (existingNit) {
        throw new BadRequestException(
          `Store with NIT ${updateStoreDto.nit} already exists`,
        );
      }
    }

    return this.prisma.store.update({
      where: { id },
      data: updateStoreDto,
    });
  }

  /**
   * Delete store (Admin only)
   * Note: Should check for related data before deletion
   */
  async remove(id: string): Promise<void> {
    // Check if store exists
    await this.findOne(id);

    // Check if store has related data
    const [vehicleCount, userCount, employeeCount] = await Promise.all([
      this.prisma.vehicle.count({ where: { storeId: id } }),
      this.prisma.user.count({ where: { storeId: id } }),
      this.prisma.employee.count({ where: { storeId: id } }),
    ]);

    if (vehicleCount > 0 || userCount > 0 || employeeCount > 0) {
      throw new BadRequestException(
        `Cannot delete store with existing vehicles (${vehicleCount}), clients (${userCount}), or employees (${employeeCount}). Please transfer or remove them first.`,
      );
    }

    await this.prisma.store.delete({
      where: { id },
    });
  }

  /**
   * Get store summary with statistics (Admin only)
   */
  async getStoreSummary(id: string): Promise<StoreSummaryDto> {
    const store = await this.findOne(id);

    const [vehicleCount, activeLoanCount, totalRevenue] =
      await Promise.all([
        // Total vehicles
        this.prisma.vehicle.count({
          where: { storeId: id },
        }),

        // Active loans (not archived)
        this.prisma.loan.count({
          where: {
            storeId: id,
            archived: false,
            status: 'ACTIVE',
          },
        }),

        // Total revenue (sum of all installment payments)
        this.prisma.installment
          .aggregate({
            where: { storeId: id },
            _sum: { amount: true },
          })
          .then((result) => result._sum.amount || 0),
      ]);

    // Count pending payments (loans with remaining installments)
    const pendingPayments = await this.prisma.loan.aggregate({
      where: {
        storeId: id,
        archived: false,
        remainingInstallments: { gt: 0 },
      },
      _sum: { remainingInstallments: true },
    }).then((result) => result._sum.remainingInstallments || 0);

    return {
      storeId: store.id,
      storeName: store.name,
      storeCode: store.code,
      totalVehicles: vehicleCount,
      activeLoans: activeLoanCount,
      totalRevenue: Number(totalRevenue),
      pendingPayments,
    };
  }

  /**
   * Transfer vehicle to another store (Admin only)
   */
  async transferVehicle(
    vehicleId: string,
    targetStoreId: string,
    reason: string,
    adminId: string,
  ): Promise<void> {
    // Validate vehicle exists
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        loans: {
          where: { archived: false },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${vehicleId} not found`);
    }

    // Check for active loans
    if (vehicle.loans.length > 0) {
      throw new BadRequestException(
        'Cannot transfer vehicle with active loans. Archive loans first.',
      );
    }

    // Validate target store
    const targetStore = await this.findOne(targetStoreId);

    if (targetStore.status !== StoreStatus.ACTIVE) {
      throw new BadRequestException('Target store is not active');
    }

    // Transfer vehicle
    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { storeId: targetStoreId },
    });

    // Audit log would go here
    console.log(`Vehicle ${vehicleId} transferred to store ${targetStoreId} by admin ${adminId}. Reason: ${reason}`);
  }

  /**
   * Transfer loan to another store (Admin only)
   * This is complex as it requires moving vehicle and user as well
   */
  async transferLoan(
    loanId: string,
    targetStoreId: string,
    reason: string,
    adminId: string,
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      // Get loan with relations
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: {
          vehicle: true,
          user: true,
          payments: true,
        },
      });

      if (!loan) {
        throw new NotFoundException(`Loan with ID ${loanId} not found`);
      }

      // Validate target store
      const targetStore = await tx.store.findUnique({
        where: { id: targetStoreId },
      });

      if (!targetStore || targetStore.status !== StoreStatus.ACTIVE) {
        throw new BadRequestException('Invalid or inactive target store');
      }

      // Transfer vehicle
      await tx.vehicle.update({
        where: { id: loan.vehicleId },
        data: { storeId: targetStoreId },
      });

      // Check if user already exists in target store
      const existingUser = await tx.user.findFirst({
        where: {
          storeId: targetStoreId,
          identification: loan.user.identification,
        },
      });

      let targetUserId: string;

      if (existingUser) {
        targetUserId = existingUser.id;
      } else {
        // Transfer user to new store
        await tx.user.update({
          where: { id: loan.userId },
          data: { storeId: targetStoreId },
        });
        targetUserId = loan.userId;
      }

      // Transfer loan
      await tx.loan.update({
        where: { id: loanId },
        data: {
          storeId: targetStoreId,
          userId: targetUserId,
        },
      });

      // Transfer all installments
      await tx.installment.updateMany({
        where: { loanId: loanId },
        data: { storeId: targetStoreId },
      });

      console.log(`Loan ${loanId} transferred to store ${targetStoreId} by admin ${adminId}. Reason: ${reason}`);
    });
  }

  /**
   * Reassign employee to different store (Admin only)
   */
  async reassignEmployee(
    employeeId: string,
    newStoreId: string,
    reason: string,
    adminId: string,
  ): Promise<void> {
    // Validate employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { store: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    // Cannot reassign admin users
    if (employee.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot reassign admin users');
    }

    // Validate target store
    const targetStore = await this.findOne(newStoreId);

    if (targetStore.status !== StoreStatus.ACTIVE) {
      throw new BadRequestException('Target store is not active');
    }

    // Update employee
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        storeId: newStoreId,
        refreshToken: null, // Force re-login
      },
    });

    console.log(`Employee ${employeeId} reassigned to store ${newStoreId} by admin ${adminId}. Reason: ${reason}`);
  }

  /**
   * Get WhatsApp configuration for a store
   */
  async getWhatsAppConfig(storeId: string) {
    const store = await this.findOne(storeId);
    
    return {
      whatsappEnabled: store.whatsappEnabled,
      whatsappApiUrl: store.whatsappApiUrl,
      whatsappInstanceId: store.whatsappInstanceId,
      // Don't expose the full API key, only show if it exists
      hasApiKey: !!store.whatsappApiKey,
      isConfigured: !!(
        store.whatsappApiUrl &&
        store.whatsappInstanceId &&
        store.whatsappApiKey
      ),
    };
  }

  /**
   * Update WhatsApp configuration for a store
   */
  async updateWhatsAppConfig(
    storeId: string,
    config: {
      whatsappEnabled: boolean;
      whatsappApiUrl?: string;
      whatsappInstanceId?: string;
      whatsappApiKey?: string;
    },
  ) {
    // Validate store exists
    await this.findOne(storeId);

    // If enabling WhatsApp, validate all required fields are provided
    if (config.whatsappEnabled) {
      const missingFields: string[] = [];
      
      if (!config.whatsappApiUrl) missingFields.push('whatsappApiUrl');
      if (!config.whatsappInstanceId) missingFields.push('whatsappInstanceId');
      if (!config.whatsappApiKey) missingFields.push('whatsappApiKey');

      if (missingFields.length > 0) {
        throw new BadRequestException(
          `Cannot enable WhatsApp without required fields: ${missingFields.join(', ')}`,
        );
      }
    }

    const updatedStore = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        whatsappEnabled: config.whatsappEnabled,
        whatsappApiUrl: config.whatsappApiUrl,
        whatsappInstanceId: config.whatsappInstanceId,
        whatsappApiKey: config.whatsappApiKey,
      },
    });

    return {
      whatsappEnabled: updatedStore.whatsappEnabled,
      whatsappApiUrl: updatedStore.whatsappApiUrl,
      whatsappInstanceId: updatedStore.whatsappInstanceId,
      hasApiKey: !!updatedStore.whatsappApiKey,
      isConfigured: !!(
        updatedStore.whatsappApiUrl &&
        updatedStore.whatsappInstanceId &&
        updatedStore.whatsappApiKey
      ),
    };
  }

  /**
   * Get admin dashboard with all stores overview
   */
  async getAdminDashboard() {
    const stores = await this.prisma.store.findMany({
      include: {
        _count: {
          select: {
            vehicles: true,
            loans: true,
            employees: true,
            providers: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Get aggregate stats across all stores
    const [totalVehicles, totalLoans, totalEmployees, totalProviders, activeLoans, revenueData] =
      await Promise.all([
        this.prisma.vehicle.count(),
        this.prisma.loan.count(),
        this.prisma.employee.count({ where: { role: UserRole.EMPLOYEE } }),
        this.prisma.provider.count(),
        this.prisma.loan.count({
          where: {
            status: {
              in: ['ACTIVE', 'PENDING'],
            },
          },
        }),
        this.prisma.installment.aggregate({
          _sum: {
            amount: true,
            gps: true,
          },
        }),
      ]);

    const totalRevenue =
      ((revenueData._sum?.amount || 0) as number) + ((revenueData._sum?.gps || 0) as number);

    // Get detailed stats per store
    const storesWithStats = await Promise.all(
      stores.map(async (store) => {
        const [activeLoansCount, vehiclesInUse, monthlyRevenue, pendingPayments] =
          await Promise.all([
            this.prisma.loan.count({
              where: {
                storeId: store.id,
                status: { in: ['ACTIVE', 'PENDING'] },
              },
            }),
            this.prisma.vehicle.count({
              where: {
                storeId: store.id,
                loans: {
                  some: {
                    status: { in: ['ACTIVE', 'PENDING'] },
                  },
                },
              },
            }),
            this.prisma.installment.aggregate({
              _sum: {
                amount: true,
                gps: true,
              },
              where: {
                loan: { storeId: store.id },
                createdAt: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
              },
            }),
            this.prisma.loan.aggregate({
              _sum: {
                debtRemaining: true,
              },
              where: {
                storeId: store.id,
                status: 'ACTIVE',
              },
            }),
          ]);

        const monthlyRevenueTotal =
          ((monthlyRevenue._sum?.amount || 0) as number) +
          ((monthlyRevenue._sum?.gps || 0) as number);
        const pendingPaymentsTotal = (pendingPayments._sum?.debtRemaining || 0) as number;

        return {
          id: store.id,
          name: store.name,
          code: store.code,
          city: store.city,
          status: store.status,
          whatsappEnabled: store.whatsappEnabled,
          whatsappConfigured: !!(
            store.whatsappApiUrl &&
            store.whatsappInstanceId &&
            store.whatsappApiKey
          ),
          stats: {
            totalVehicles: store._count.vehicles,
            totalLoans: store._count.loans,
            totalEmployees: store._count.employees,
            totalProviders: store._count.providers,
            activeLoans: activeLoansCount,
            vehiclesInUse,
            monthlyRevenue: monthlyRevenueTotal,
            pendingPayments: pendingPaymentsTotal,
          },
        };
      }),
    );

    return {
      overview: {
        totalStores: stores.length,
        activeStores: stores.filter((s) => s.status === 'ACTIVE').length,
        totalVehicles,
        totalLoans,
        totalEmployees,
        totalProviders,
        activeLoans,
        totalRevenue,
      },
      stores: storesWithStats,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProviderStats, ProviderDetailsResponse } from './dto/provider-stats.dto';
import { BaseStoreService } from 'src/lib/base-store.service';

@Injectable()
export class ProvidersService extends BaseStoreService {
  constructor(protected readonly prismaService: PrismaService) {
    super(prismaService);
  }

  /**
   * Creates a new provider.
   * @param createProviderDto - The data transfer object containing provider details.
   */
  async create(createProviderDto: CreateProviderDto, storeId: string) {
    return this.prismaService.provider.create({
      data: {
        name: createProviderDto.name,
        store: { connect: { id: storeId } },
      },
    });
  }

  /**
   * Returns all providers.
   * @param userStoreId - The store ID of the authenticated user (null for ADMIN)
   */
  async findAll(userStoreId: string | null) {
    return this.prismaService.provider.findMany({
      where: this.storeFilter(userStoreId),
      include: {
        vehicles: true,
        cashRegisters: {
          include: {
            createdBy: {
              select: {
                name: true,
                username: true
              }
            }
          }
        },
      }
    });
  }

  /**
   * Returns a single provider by ID.
   * @param id - The ID of the provider to retrieve.
   * @param userStoreId - The store ID of the authenticated user (null for ADMIN)
   */
  async findOne(id: string, userStoreId: string | null) {
    const provider = await this.prismaService.provider.findUnique({
      where: { id },
      include: {
        vehicles: true,
        cashRegisters: true,
      },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    // Validate store access
    this.validateStoreAccess(provider, userStoreId);

    return provider;
  }

  /**
   * Updates a provider by ID.
   * @param id - The ID of the provider to update.
   * @param updateProviderDto - The data transfer object with updated fields.
   * @param userStoreId - The store ID of the authenticated user (null for ADMIN)
   */
  async update(id: string, updateProviderDto: UpdateProviderDto, userStoreId: string | null) {
    const exists = await this.prismaService.provider.findUnique({
      where: { id },
    });

    if (!exists) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    // Validate store access
    this.validateStoreAccess(exists, userStoreId);

    return this.prismaService.provider.update({
      where: { id },
      data: updateProviderDto,
    });
  }

  /**
   * Deletes a provider by ID.
   * @param id - The ID of the provider to delete.
   * @param userStoreId - The store ID of the authenticated user (null for ADMIN)
   */
  async remove(id: string, userStoreId: string | null) {
    const exists = await this.prismaService.provider.findUnique({
      where: { id },
    });

    if (!exists) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    // Validate store access
    this.validateStoreAccess(exists, userStoreId);

    return this.prismaService.provider.delete({
      where: { id },
    });
  }

  /**
   * Get comprehensive statistics for all providers
   * @param userStoreId - The store ID of the authenticated user (null for ADMIN)
   */
  async getProvidersStats(userStoreId: string | null): Promise<ProviderStats[]> {
    const providers = await this.prismaService.provider.findMany({
      where: this.storeFilter(userStoreId),
      include: {
        vehicles: {
          include: {
            loans: {
              include: {
                payments: true,
              },
            },
          },
        },
        cashRegisters: true,
        expenses: true,
      },
    });

    return providers.map(provider => this.calculateProviderStats(provider));
  }

  /**
   * Get detailed information for a specific provider
   * @param userStoreId - The store ID of the authenticated user (null for ADMIN)
   */
  async getProviderDetails(id: string, userStoreId: string | null): Promise<ProviderDetailsResponse> {
    const provider = await this.prismaService.provider.findUnique({
      where: { id },
      include: {
        vehicles: {
          include: {
            loans: {
              include: {
                payments: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        cashRegisters: {
          orderBy: {
            date: 'desc',
          },
        },
        expenses: {
          orderBy: {
            date: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }

    // Validate store access
    this.validateStoreAccess(provider, userStoreId);

    const stats = this.calculateProviderStats(provider);

    // Get recent vehicles (last 5)
    const recentVehicles = provider.vehicles.slice(0, 5).map(vehicle => ({
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      year: 0, // Not available in schema
      plate: vehicle.plate,
      status: 'UNKNOWN', // Not available in schema
      purchasePrice: vehicle.price || 0,
      createdAt: vehicle.createdAt,
    }));

    // Get recent loans (last 5)
    const allLoans = provider.vehicles.flatMap(vehicle => 
      vehicle.loans.map(loan => ({
        ...loan,
        vehicle: {
          brand: vehicle.brand,
          model: vehicle.model,
          plate: vehicle.plate,
        },
      }))
    );
    const recentLoans = allLoans
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 5)
      .map(loan => ({
        id: loan.id,
        loanAmount: loan.totalAmount,
        status: loan.status,
        startDate: loan.startDate,
        vehicle: loan.vehicle,
        user: loan.user,
      }));

    // Recent expenses (already limited to 10)
    const recentExpenses = provider.expenses.map(expense => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
    }));

    return {
      provider: {
        id: provider.id,
        name: provider.name,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      },
      stats,
      recentVehicles,
      recentLoans,
      recentExpenses,
    };
  }

  /**
   * Calculate statistics for a provider
   */
  private calculateProviderStats(provider: any): ProviderStats {
    const totalVehicles = provider.vehicles.length;

    // Calculate vehicle status counts (Vehicle model doesn't have status, so we'll use loan status as proxy)
    const vehiclesByStatus = {
      AVAILABLE: 0,
      RENTED: 0,
      MAINTENANCE: 0,
      SOLD: 0,
    };

    // Count rented vehicles (vehicles with active loans)
    provider.vehicles.forEach(vehicle => {
      const hasActiveLoan = vehicle.loans?.some(loan => loan.status === 'ACTIVE');
      if (hasActiveLoan) {
        vehiclesByStatus.RENTED++;
      } else {
        vehiclesByStatus.AVAILABLE++;
      }
    });

    // Calculate loan statistics
    const allLoans = provider.vehicles.flatMap(vehicle => vehicle.loans || []);
    const activeLoans = allLoans.filter(loan => loan.status === 'ACTIVE').length;
    const completedLoans = allLoans.filter(loan => loan.status === 'COMPLETED').length;

    // Calculate financial data
    const allInstallments = allLoans.flatMap(loan => loan.payments || []);
    const totalRevenue = allInstallments
      .filter(installment => installment.status === 'PAID')
      .reduce((sum, installment) => sum + installment.amount, 0);

    const pendingPayments = allInstallments
      .filter(installment => installment.status === 'PENDING' || installment.status === 'LATE')
      .reduce((sum, installment) => sum + installment.amount, 0);

    const totalExpenses = provider.expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;

    // Cash register data
    const totalCashRegisters = provider.cashRegisters?.length || 0;
    const lastCashRegisterDate = provider.cashRegisters?.[0]?.date || null;

    // Recent activity
    const lastLoan = allLoans.length > 0
      ? allLoans.reduce((latest, loan) => 
          new Date(loan.startDate) > new Date(latest.startDate) ? loan : latest
        ).startDate
      : null;

    const lastPayment = allInstallments.length > 0
      ? allInstallments
          .filter(i => i.paymentDate)
          .reduce((latest, installment) => 
            new Date(installment.paymentDate) > new Date(latest.paymentDate) ? installment : latest
          , allInstallments.find(i => i.paymentDate))?.paymentDate || null
      : null;

    const lastExpense = provider.expenses?.length > 0
      ? provider.expenses[0].date
      : null;

    // Financial summary
    const totalIncome = totalRevenue;
    const netProfit = totalIncome - totalExpenses;

    return {
      id: provider.id,
      name: provider.name,
      totalVehicles,
      activeLoans,
      completedLoans,
      totalRevenue,
      pendingPayments,
      totalCashRegisters,
      lastCashRegisterDate,
      totalExpenses,
      vehiclesByStatus,
      recentActivity: {
        lastLoan,
        lastPayment,
        lastExpense,
      },
      financialSummary: {
        totalIncome,
        totalExpenses,
        netProfit,
      },
    };
  }
}

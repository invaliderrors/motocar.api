import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, addDays } from 'date-fns';
import { LoanStatus } from 'src/prisma/generated/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) { }

  async getDashboardData(dateRange?: string) {
    const now = new Date();
    const startDate = dateRange ? new Date(dateRange) : startOfMonth(now);
    const endDate = endOfMonth(now);

    // Parallel queries for better performance
    const [
      stats,
      cashFlow,
      loanStatusDistribution,
      recentLoans,
      archivedLoans,
      overview,
      upcomingPayments,
      pendingPaymentsThisWeek,
      recentInstallments,
    ] = await Promise.all([
      this.getStats(),
      this.getCashFlow(),
      this.getLoanStatusDistribution(),
      this.getRecentLoans(),
      this.getArchivedLoans(),
      this.getOverview(),
      this.getUpcomingPayments(),
      this.getPendingPaymentsThisWeek(),
      this.getRecentInstallments(),
    ]);

    return {
      stats,
      cashFlow,
      loanStatusDistribution,
      recentLoans,
      archivedLoans,
      overview,
      upcomingPayments,
      recentInstallments,
      alerts: {
        pendingPaymentsThisWeek,
      },
    };
  }

  private async getStats() {
    const now = new Date();
    const lastMonth = subMonths(now, 1);

    const [
      totalUsers,
      totalVehicles,
      activeLoans,
      totalInstallments,
      revenueData,
      pendingPaymentsData,
      lastMonthLoans,
      lastMonthRevenue,
    ] = await Promise.all([
      // Total users
      this.prisma.user.count(),

      // Total vehicles
      this.prisma.vehicle.count(),

      // Active loans
      this.prisma.loan.count({
        where: {
          status: {
            in: [LoanStatus.ACTIVE, LoanStatus.PENDING],
          },
        },
      }),

      // Total installments
      this.prisma.installment.count(),

      // Total revenue (sum of all installments paid)
      this.prisma.installment.aggregate({
        _sum: {
          amount: true,
          gps: true,
        },
      }),

      // Pending payments (loans with remaining debt)
      this.prisma.loan.aggregate({
        _sum: {
          debtRemaining: true,
        },
        where: {
          status: LoanStatus.ACTIVE,
        },
      }),

      // Last month loans for growth calculation
      this.prisma.loan.count({
        where: {
          createdAt: {
            gte: startOfMonth(lastMonth),
            lte: endOfMonth(lastMonth),
          },
        },
      }),

      // Last month revenue for growth calculation
      this.prisma.installment.aggregate({
        _sum: {
          amount: true,
          gps: true,
        },
        where: {
          createdAt: {
            gte: startOfMonth(lastMonth),
            lte: endOfMonth(lastMonth),
          },
        },
      }),
    ]);

    const totalRevenue = (revenueData._sum.amount || 0) + (revenueData._sum.gps || 0);
    const pendingPayments = pendingPaymentsData._sum.debtRemaining || 0;
    const lastMonthTotal = (lastMonthRevenue._sum.amount || 0) + (lastMonthRevenue._sum.gps || 0);

    // Calculate growth rate
    const growthRate = lastMonthTotal > 0
      ? ((totalRevenue - lastMonthTotal) / lastMonthTotal) * 100
      : 0;

    // Calculate default rate
    const defaultedLoans = await this.prisma.loan.count({
      where: { status: LoanStatus.DEFAULTED },
    });
    const totalLoans = await this.prisma.loan.count();
    const defaultRate = totalLoans > 0 ? (defaultedLoans / totalLoans) * 100 : 0;

    return {
      totalUsers,
      totalVehicles,
      totalLoans: activeLoans,
      totalInstallments,
      totalRevenue,
      pendingPayments,
      growthRate: Number(growthRate.toFixed(2)),
      defaultRate: Number(defaultRate.toFixed(2)),
    };
  }

  private async getCashFlow() {
    const now = new Date();
    const monthsData: Array<{
      name: string;
      month: number;
      year: number;
      ingresos: number;
      egresos: number;
      net: number;
    }> = [];

    // Get last 6 months of data
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);

      const [installments, expenses] = await Promise.all([
        this.prisma.installment.aggregate({
          _sum: {
            amount: true,
            gps: true,
          },
          where: {
            paymentDate: {
              gte: start,
              lte: end,
            },
          },
        }),
        this.prisma.expense.aggregate({
          _sum: {
            amount: true,
          },
          where: {
            date: {
              gte: start,
              lte: end,
            },
          },
        }),
      ]);

      const ingresos = (installments._sum.amount || 0) + (installments._sum.gps || 0);
      const egresos = expenses._sum.amount || 0;

      monthsData.push({
        name: monthDate.toLocaleDateString('es-ES', { month: 'short' }),
        month: monthDate.getMonth() + 1,
        year: monthDate.getFullYear(),
        ingresos,
        egresos,
        net: ingresos - egresos,
      });
    }

    return monthsData;
  }

  private async getLoanStatusDistribution() {
    const [active, completed, defaulted, pending] = await Promise.all([
      this.prisma.loan.count({ where: { status: LoanStatus.ACTIVE } }),
      this.prisma.loan.count({ where: { status: LoanStatus.COMPLETED } }),
      this.prisma.loan.count({ where: { status: LoanStatus.DEFAULTED } }),
      this.prisma.loan.count({ where: { status: LoanStatus.PENDING } }),
    ]);

    return [
      { name: 'Activos', value: active, status: 'ACTIVE' },
      { name: 'Completados', value: completed, status: 'COMPLETED' },
      { name: 'Incumplidos', value: defaulted, status: 'DEFAULTED' },
      { name: 'En Proceso', value: pending, status: 'PENDING' },
    ];
  }

  private async getRecentLoans() {
    const loans = await this.prisma.loan.findMany({
      take: 5,
      where: {
        archived: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            identification: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            plate: true,
          },
        },
      },
    });

    return loans.map((loan) => ({
      id: loan.id,
      userName: loan.user.name,
      userIdentification: loan.user.identification,
      vehicleModel: `${loan.vehicle.brand} ${loan.vehicle.model}`,
      vehiclePlate: loan.vehicle.plate,
      amount: loan.totalAmount,
      downPayment: loan.downPayment,
      date: loan.createdAt,
      status: loan.status,
      paidInstallments: loan.paidInstallments,
      totalInstallments: loan.installments,
    }));
  }

  private async getArchivedLoans() {
    const loans = await this.prisma.loan.findMany({
      take: 10,
      where: {
        archived: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            identification: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            plate: true,
          },
        },
      },
    });

    return loans.map((loan) => ({
      id: loan.id,
      userName: loan.user.name,
      userIdentification: loan.user.identification,
      vehicleModel: `${loan.vehicle.brand} ${loan.vehicle.model}`,
      vehiclePlate: loan.vehicle.plate,
      amount: loan.totalAmount,
      downPayment: loan.downPayment,
      date: loan.createdAt,
      status: loan.status,
      paidInstallments: loan.paidInstallments,
      totalInstallments: loan.installments,
      isArchived: loan.archived,
      archivedAt: loan.updatedAt,
    }));
  }

  private async getOverview() {
    const now = new Date();

    // Get monthly data for last 7 months
    const monthlyData: Array<{
      name: string;
      month: number;
      year: number;
      total: number;
      pagos: number;
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);

      const [loansTotal, installmentsData] = await Promise.all([
        this.prisma.loan.aggregate({
          _sum: {
            totalAmount: true,
          },
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        }),
        this.prisma.installment.aggregate({
          _sum: {
            amount: true,
            gps: true,
          },
          where: {
            paymentDate: {
              gte: start,
              lte: end,
            },
          },
        }),
      ]);

      monthlyData.push({
        name: monthDate.toLocaleDateString('es-ES', { month: 'short' }),
        month: monthDate.getMonth() + 1,
        year: monthDate.getFullYear(),
        total: loansTotal._sum.totalAmount || 0,
        pagos: (installmentsData._sum.amount || 0) + (installmentsData._sum.gps || 0),
      });
    }

    // Get weekly data for last 7 days
    const weeklyData: Array<{
      name: string;
      day: number;
      month: number;
      year: number;
      total: number;
      pagos: number;
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayDate = subMonths(now, 0);
      dayDate.setDate(dayDate.getDate() - i);
      const start = startOfDay(dayDate);
      const end = endOfDay(dayDate);

      const [loansTotal, installmentsData] = await Promise.all([
        this.prisma.loan.aggregate({
          _sum: {
            totalAmount: true,
          },
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        }),
        this.prisma.installment.aggregate({
          _sum: {
            amount: true,
            gps: true,
          },
          where: {
            paymentDate: {
              gte: start,
              lte: end,
            },
          },
        }),
      ]);

      weeklyData.push({
        name: dayDate.toLocaleDateString('es-ES', { weekday: 'short' }),
        day: dayDate.getDate(),
        month: dayDate.getMonth() + 1,
        year: dayDate.getFullYear(),
        total: loansTotal._sum.totalAmount || 0,
        pagos: (installmentsData._sum.amount || 0) + (installmentsData._sum.gps || 0),
      });
    }

    return {
      monthly: monthlyData,
      weekly: weeklyData,
    };
  }

  private async getUpcomingPayments() {
    const now = new Date();
    const sevenDaysFromNow = addDays(now, 7);

    // Get active loans with their expected payment schedule
    const activeLoans = await this.prisma.loan.findMany({
      where: {
        status: LoanStatus.ACTIVE,
        remainingInstallments: {
          gt: 0,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        vehicle: {
          select: {
            plate: true,
          },
        },
        payments: {
          orderBy: {
            paymentDate: 'desc',
          },
          take: 1,
        },
      },
    });

    // Calculate expected payment dates
    const upcomingPayments = activeLoans
      .map((loan) => {
        const lastPayment = loan.payments[0];
        if (!lastPayment) return null;

        let nextPaymentDate = new Date(lastPayment.paymentDate);

        // Calculate next payment date based on frequency
        switch (loan.paymentFrequency) {
          case 'DAILY':
            nextPaymentDate = addDays(nextPaymentDate, 1);
            break;
          case 'WEEKLY':
            nextPaymentDate = addDays(nextPaymentDate, 7);
            break;
          case 'BIWEEKLY':
            nextPaymentDate = addDays(nextPaymentDate, 14);
            break;
          case 'MONTHLY':
            nextPaymentDate = addDays(nextPaymentDate, 30);
            break;
          default:
            return null;
        }

        // Only include if within next 7 days
        if (nextPaymentDate > sevenDaysFromNow) {
          return null;
        }

        return {
          date: nextPaymentDate,
          amount: loan.installmentPaymentAmmount + loan.gpsInstallmentPayment,
          client: loan.user.name,
          vehiclePlate: loan.vehicle.plate,
          loanId: loan.id,
          status: nextPaymentDate < now ? 'late' : 'pending',
        };
      })
      .filter(Boolean);

    return upcomingPayments;
  }

  private async getPendingPaymentsThisWeek() {
    const now = new Date();
    const sevenDaysFromNow = addDays(now, 7);

    const upcomingPayments = await this.getUpcomingPayments();

    return upcomingPayments.filter(
      (payment) => payment && new Date(payment.date) <= sevenDaysFromNow,
    ).length;
  }

  private async getRecentInstallments() {
    const now = new Date();
    const sevenDaysAgo = subMonths(now, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const installments = await this.prisma.installment.findMany({
      where: {
        paymentDate: {
          gte: startOfDay(sevenDaysAgo),
          lte: endOfDay(now),
        },
      },
      include: {
        loan: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            vehicle: {
              select: {
                plate: true,
              },
            },
          },
        },
      },
      orderBy: {
        paymentDate: 'desc',
      },
    });

    return installments.map((installment) => ({
      date: installment.paymentDate,
      amount: installment.amount + installment.gps,
      client: installment.loan.user.name,
      vehiclePlate: installment.loan.vehicle.plate,
      loanId: installment.loanId,
      paymentMethod: installment.paymentMethod,
      isLate: installment.isLate,
      status: 'paid' as const,
    }));
  }
}

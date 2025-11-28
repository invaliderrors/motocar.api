import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface RevenueAnalyticsParams {
  storeId?: string;
  days?: number;
  startDate?: string;
  endDate?: string;
}

export interface MonthlyRevenue {
  date: string;
  revenue: number;
  loans: number;
  payments: number;
}

export interface RevenueAnalyticsResponse {
  monthlyData: MonthlyRevenue[];
  totalRevenue: number;
  averageMonthlyRevenue: number;
  growthRate: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getRevenueAnalytics(
    params: RevenueAnalyticsParams,
  ): Promise<RevenueAnalyticsResponse> {
    const { storeId, days = 90 } = params;

    // Calculate date range
    const endDate = params.endDate ? new Date(params.endDate) : new Date();
    const startDate = params.startDate
      ? new Date(params.startDate)
      : new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Get daily installment payments grouped by date
    const payments = await this.prisma.installment.groupBy({
      by: ['paymentDate'],
      where: {
        ...(storeId && { storeId }),
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
        archived: false,
      },
      _sum: {
        amount: true,
      },
      _count: {
        _all: true,
      },
    });

    // Get loans created grouped by date
    const loans = await this.prisma.loan.groupBy({
      by: ['createdAt'],
      where: {
        ...(storeId && { storeId }),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        _all: true,
      },
    });

    // Create a map of dates to revenue
    const revenueMap = new Map<string, MonthlyRevenue>();

    // Process payments
    payments.forEach((payment) => {
      const dateKey = payment.paymentDate.toISOString().split('T')[0];
      const existing = revenueMap.get(dateKey) || {
        date: dateKey,
        revenue: 0,
        loans: 0,
        payments: 0,
      };
      existing.revenue += payment._sum?.amount || 0;
      existing.payments += payment._count?._all || 0;
      revenueMap.set(dateKey, existing);
    });

    // Process loans
    loans.forEach((loan) => {
      const dateKey = loan.createdAt.toISOString().split('T')[0];
      const existing = revenueMap.get(dateKey) || {
        date: dateKey,
        revenue: 0,
        loans: 0,
        payments: 0,
      };
      existing.loans += loan._count?._all || 0;
      revenueMap.set(dateKey, existing);
    });

    // Fill in missing dates with zero values
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      if (!revenueMap.has(dateKey)) {
        revenueMap.set(dateKey, {
          date: dateKey,
          revenue: 0,
          loans: 0,
          payments: 0,
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Convert to array and sort by date
    const monthlyData = Array.from(revenueMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Calculate totals
    const totalRevenue = monthlyData.reduce(
      (sum, item) => sum + item.revenue,
      0,
    );
    const averageMonthlyRevenue =
      monthlyData.length > 0 ? totalRevenue / monthlyData.length : 0;

    // Calculate growth rate (comparing first half to second half)
    const midPoint = Math.floor(monthlyData.length / 2);
    const firstHalfRevenue = monthlyData
      .slice(0, midPoint)
      .reduce((sum, item) => sum + item.revenue, 0);
    const secondHalfRevenue = monthlyData
      .slice(midPoint)
      .reduce((sum, item) => sum + item.revenue, 0);

    const growthRate =
      firstHalfRevenue > 0
        ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
        : 0;

    return {
      monthlyData,
      totalRevenue,
      averageMonthlyRevenue,
      growthRate: Math.round(growthRate * 100) / 100, // Round to 2 decimal places
    };
  }
}

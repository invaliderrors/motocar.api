import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CashFlowStatementDto,
  ForecastDto,
  ReportFormat,
  ForecastScenario,
} from '../dto/report.dto';
import { format } from 'date-fns';

@Injectable()
export class CashFlowReportService {
  constructor(private prisma: PrismaService) {}

  async generateCashFlowStatement(dto: CashFlowStatementDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Build where clause
    const where: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (dto.accountId) {
      where.accountId = dto.accountId;
    }

    if (dto.currency && dto.currency !== 'COP') {
      where.currency = dto.currency;
    }

    // Fetch all transactions in the period
    const transactions = await this.prisma.cashFlowTransaction.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            name: true,
            accountType: true,
            currency: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Check for multi-currency without exchange rates
    const currencies = [...new Set(transactions.map((t) => t.currency))];
    if (currencies.length > 1) {
      const baseCurrency = dto.currency || 'COP';
      const otherCurrencies = currencies.filter((c) => c !== baseCurrency);

      for (const currency of otherCurrencies) {
        const hasRate = await this.prisma.exchangeRate.findFirst({
          where: {
            fromCurrency: currency,
            toCurrency: baseCurrency,
            effectiveDate: {
              lte: endDate,
            },
          },
          orderBy: {
            effectiveDate: 'desc',
          },
        });

        if (!hasRate) {
          throw new UnprocessableEntityException(
            `Missing exchange rate from ${currency} to ${baseCurrency}. ` +
              `Please add exchange rate data before generating multi-currency reports.`,
          );
        }
      }
    }

    // Categorize transactions into cash flow statement sections
    const operating = this.categorizeOperating(transactions);
    const investing = this.categorizeInvesting(transactions);
    const financing = this.categorizeFinancing(transactions);

    const statement = {
      period: {
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
      currency: dto.currency || 'COP',
      operatingActivities: {
        inflows: operating.inflows,
        outflows: operating.outflows,
        net: operating.inflows - operating.outflows,
        transactions: operating.transactions,
      },
      investingActivities: {
        inflows: investing.inflows,
        outflows: investing.outflows,
        net: investing.inflows - investing.outflows,
        transactions: investing.transactions,
      },
      financingActivities: {
        inflows: financing.inflows,
        outflows: financing.outflows,
        net: financing.inflows - financing.outflows,
        transactions: financing.transactions,
      },
      summary: {
        totalInflows: operating.inflows + investing.inflows + financing.inflows,
        totalOutflows: operating.outflows + investing.outflows + financing.outflows,
        netCashFlow:
          operating.inflows +
          investing.inflows +
          financing.inflows -
          (operating.outflows + investing.outflows + financing.outflows),
        operatingCashFlow: operating.inflows - operating.outflows,
        investingCashFlow: investing.inflows - investing.outflows,
        financingCashFlow: financing.inflows - financing.outflows,
      },
    };

    // Format response based on requested format
    if (dto.format === ReportFormat.CSV) {
      return this.formatAsCSV(statement);
    } else if (dto.format === ReportFormat.PDF) {
      return this.formatAsPDF(statement);
    }

    return statement;
  }

  async generateForecast(dto: ForecastDto) {
    const weeks = dto.weeks || 13;
    const scenario = dto.scenario || ForecastScenario.BASE;
    const deltaPercent = dto.scenarioDeltaPercent || 10;

    // Get scheduled items
    const scheduledItems = await this.prisma.cashFlowScheduledItem.findMany({
      where: {
        isActive: true,
        ...(dto.accountId && { accountId: dto.accountId }),
      },
    });

    // Get historical patterns (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const historicalTx = await this.prisma.cashFlowTransaction.findMany({
      where: {
        date: {
          gte: ninetyDaysAgo,
        },
        ...(dto.accountId && { accountId: dto.accountId }),
      },
      include: {
        account: true,
      },
    });

    // Calculate weekly averages by category
    const weeklyAverages = this.calculateWeeklyAverages(historicalTx);

    // Generate forecast
    const forecast: any[] = [];
    const today = new Date();

    for (let week = 1; week <= weeks; week++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + (week - 1) * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Get scheduled items for this week
      const scheduledForWeek = this.getScheduledItemsForWeek(
        scheduledItems,
        weekStart,
        weekEnd,
      );

      // Calculate projected amounts
      let projectedInflows = scheduledForWeek
        .filter((item) => item.type === 'INFLOW')
        .reduce((sum, item) => sum + item.amount, 0);

      let projectedOutflows = scheduledForWeek
        .filter((item) => item.type === 'OUTFLOW')
        .reduce((sum, item) => sum + item.amount, 0);

      // Add historical patterns
      for (const [category, avgAmount] of Object.entries(weeklyAverages.inflows)) {
        projectedInflows += avgAmount as number;
      }

      for (const [category, avgAmount] of Object.entries(weeklyAverages.outflows)) {
        projectedOutflows += avgAmount as number;
      }

      // Apply scenario adjustments
      if (scenario === ForecastScenario.BEST) {
        projectedInflows *= 1 + deltaPercent / 100;
        projectedOutflows *= 1 - deltaPercent / 100;
      } else if (scenario === ForecastScenario.WORST) {
        projectedInflows *= 1 - deltaPercent / 100;
        projectedOutflows *= 1 + deltaPercent / 100;
      }

      const netCashFlow = projectedInflows - projectedOutflows;
      const previousBalance = week === 1 ? 0 : forecast[week - 2].endingBalance;
      const endingBalance = previousBalance + netCashFlow;

      forecast.push({
        week,
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(weekEnd, 'yyyy-MM-dd'),
        projectedInflows: Math.round(projectedInflows * 100) / 100,
        projectedOutflows: Math.round(projectedOutflows * 100) / 100,
        netCashFlow: Math.round(netCashFlow * 100) / 100,
        endingBalance: Math.round(endingBalance * 100) / 100,
        scheduledItems: scheduledForWeek.length,
      });
    }

    return {
      scenario,
      weeks,
      generatedAt: new Date().toISOString(),
      currentBalance: await this.getCurrentBalance(dto.accountId),
      forecast,
      summary: {
        totalProjectedInflows: forecast.reduce((sum, w) => sum + w.projectedInflows, 0),
        totalProjectedOutflows: forecast.reduce((sum, w) => sum + w.projectedOutflows, 0),
        averageWeeklyInflows:
          forecast.reduce((sum, w) => sum + w.projectedInflows, 0) / weeks,
        averageWeeklyOutflows:
          forecast.reduce((sum, w) => sum + w.projectedOutflows, 0) / weeks,
        finalProjectedBalance: forecast[forecast.length - 1].endingBalance,
      },
    };
  }

  private categorizeOperating(transactions: any[]) {
    const operatingCategories = [
      'CUSTOMER_PAYMENT',
      'VENDOR_PAYMENT',
      'SALARY_PAYMENT',
      'RENT_PAYMENT',
      'UTILITIES_PAYMENT',
      'TAX_PAYMENT',
      'INTEREST_PAYMENT',
      'SERVICE_PAYMENT',
    ];

    const filtered = transactions.filter((t) => operatingCategories.includes(t.category));

    return {
      inflows: filtered
        .filter((t) => t.type === 'INFLOW')
        .reduce((sum, t) => sum + t.amount, 0),
      outflows: filtered
        .filter((t) => t.type === 'OUTFLOW')
        .reduce((sum, t) => sum + t.amount, 0),
      transactions: filtered,
    };
  }

  private categorizeInvesting(transactions: any[]) {
    const investingCategories = [
      'ASSET_PURCHASE',
      'ASSET_SALE',
      'INVESTMENT_PURCHASE',
      'INVESTMENT_SALE',
      'LOAN_DISBURSEMENT',
      'LOAN_REPAYMENT_RECEIVED',
    ];

    const filtered = transactions.filter((t) => investingCategories.includes(t.category));

    return {
      inflows: filtered
        .filter((t) => t.type === 'INFLOW')
        .reduce((sum, t) => sum + t.amount, 0),
      outflows: filtered
        .filter((t) => t.type === 'OUTFLOW')
        .reduce((sum, t) => sum + t.amount, 0),
      transactions: filtered,
    };
  }

  private categorizeFinancing(transactions: any[]) {
    const financingCategories = [
      'EQUITY_INJECTION',
      'EQUITY_WITHDRAWAL',
      'LOAN_RECEIVED',
      'LOAN_REPAYMENT_MADE',
      'DIVIDEND_PAYMENT',
    ];

    const filtered = transactions.filter((t) => financingCategories.includes(t.category));

    return {
      inflows: filtered
        .filter((t) => t.type === 'INFLOW')
        .reduce((sum, t) => sum + t.amount, 0),
      outflows: filtered
        .filter((t) => t.type === 'OUTFLOW')
        .reduce((sum, t) => sum + t.amount, 0),
      transactions: filtered,
    };
  }

  private calculateWeeklyAverages(transactions: any[]) {
    const inflows: any = {};
    const outflows: any = {};

    transactions.forEach((tx) => {
      if (tx.type === 'INFLOW') {
        inflows[tx.category] = (inflows[tx.category] || 0) + tx.amount;
      } else {
        outflows[tx.category] = (outflows[tx.category] || 0) + tx.amount;
      }
    });

    // Convert to weekly averages (90 days ≈ 13 weeks)
    const weeks = 13;
    Object.keys(inflows).forEach((key) => {
      inflows[key] = inflows[key] / weeks;
    });
    Object.keys(outflows).forEach((key) => {
      outflows[key] = outflows[key] / weeks;
    });

    return { inflows, outflows };
  }

  private getScheduledItemsForWeek(items: any[], weekStart: Date, weekEnd: Date) {
    return items.filter((item) => {
      const nextOccurrence = new Date(item.nextOccurrence);
      return nextOccurrence >= weekStart && nextOccurrence <= weekEnd;
    });
  }

  private async getCurrentBalance(accountId?: string) {
    if (accountId) {
      const account = await this.prisma.cashFlowAccount.findUnique({
        where: { id: accountId },
      });
      return account?.balance || 0;
    }

    const accounts = await this.prisma.cashFlowAccount.findMany({
      where: { isActive: true },
    });

    return accounts.reduce((sum, acc) => sum + acc.balance, 0);
  }

  private formatAsCSV(statement: any) {
    // CSV export (simplified)
    const rows = [
      ['Cash Flow Statement'],
      ['Period', `${statement.period.startDate} to ${statement.period.endDate}`],
      ['Currency', statement.currency],
      [],
      ['Category', 'Type', 'Amount'],
      ['Operating Activities - Inflows', 'Inflow', statement.operatingActivities.inflows],
      ['Operating Activities - Outflows', 'Outflow', statement.operatingActivities.outflows],
      ['Operating Activities - Net', 'Net', statement.operatingActivities.net],
      [],
      ['Investing Activities - Inflows', 'Inflow', statement.investingActivities.inflows],
      ['Investing Activities - Outflows', 'Outflow', statement.investingActivities.outflows],
      ['Investing Activities - Net', 'Net', statement.investingActivities.net],
      [],
      ['Financing Activities - Inflows', 'Inflow', statement.financingActivities.inflows],
      ['Financing Activities - Outflows', 'Outflow', statement.financingActivities.outflows],
      ['Financing Activities - Net', 'Net', statement.financingActivities.net],
      [],
      ['Total Inflows', 'Inflow', statement.summary.totalInflows],
      ['Total Outflows', 'Outflow', statement.summary.totalOutflows],
      ['Net Cash Flow', 'Net', statement.summary.netCashFlow],
    ];

    const csv = rows.map((row) => row.join(',')).join('\n');
    return {
      format: 'CSV',
      content: csv,
      filename: `cash_flow_statement_${format(new Date(), 'yyyy-MM-dd')}.csv`,
    };
  }

  private formatAsPDF(statement: any) {
    // PDF generation would integrate with your existing PDF service
    // For now, return a structure that can be processed by your PDF renderer
    return {
      format: 'PDF',
      status: 'not_implemented',
      message:
        'PDF generation should be integrated with existing PDF renderer service. ' +
        'Implement using your Puppeteer-based receipt/closing PDF generation pattern.',
      data: statement,
    };
  }
}

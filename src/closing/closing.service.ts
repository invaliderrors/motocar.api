import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import { PrismaService } from "src/prisma/prisma.service"
import { BaseStoreService } from "src/lib/base-store.service"
import type {
  CreateCashRegisterDto,
  FilterCashRegisterDto,
  FilterInstallmentsDto,
  FindOneCashRegisterResponseDto,
  GetResumenDto,
} from "./dto"
import { subDays } from "date-fns"
import { getColombiaDayRange } from "src/lib/dates"
import * as puppeteer from "puppeteer"
import { templateHtml } from "./template"
import { format, utcToZonedTime } from "date-fns-tz"
import { es } from "date-fns/locale"
import type { 
  CashRegister, 
  Loan, 
  Employee, 
  Provider, 
  User, 
  Vehicle, 
  Installment, 
  Expense, 
  Prisma 
} from "src/prisma/generated/client"

type CashRegisterWithRelations = CashRegister & {
  payments: (Installment & {
    loan: Loan & {
      user: Pick<User, "id" | "name">
      vehicle: Pick<Vehicle, "id" | "plate">
    }
    createdBy: Pick<Employee, "id" | "username" | "name"> | null
  })[]
  expense: (Expense & {
    createdBy: Pick<Employee, "id" | "username" | "name"> | null
  })[]
  createdBy: Pick<Employee, "id" | "username" | "name"> | null
  provider: Pick<Provider, "id" | "name">
  denominationCount: {
    bills_100000: number
    bills_50000: number
    bills_20000: number
    bills_10000: number
    bills_5000: number
    bills_2000: number
    bills_1000: number
    coins_500: number
    coins_200: number
    coins_100: number
    totalCounted: number
    systemCash: number
    difference: number
  } | null
}

type InstallmentWithLoan = Installment & {
  loan: Loan & {
    user: Pick<User, "id" | "name">
    vehicle: (Pick<Vehicle, "id" | "plate" | "providerId"> & {
      provider: Provider | null
    })
  }
  createdBy: Pick<Employee, "id" | "username"> | null
}

@Injectable()
export class ClosingService extends BaseStoreService {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async create(
    dto: CreateCashRegisterDto,
    userStoreId: string | null,
  ): Promise<CashRegister & { payments: Installment[]; expense: Expense[] }> {
    const {
      cashInRegister,
      cashFromTransfers,
      cashFromCards,
      notes,
      providerId,
      installmentIds,
      expenseIds = [],
      createdById,
      closingDate,
      cashCounted,
      denominationCounts,
    } = dto;

    // Get the store ID to use for creation (either user's store or explicitly provided)
    const storeId = this.getStoreIdForCreate(userStoreId, dto.storeId);

    // Normalize to just the date part (YYYY-MM-DD) for comparison
    const normalizeDate = (date: Date): string => {
      return date.toISOString().split('T')[0];
    };

    // Fetch and validate installments with store filtering
    const installments = await this.prisma.installment.findMany({
      where: { 
        id: { in: installmentIds },
        ...this.storeFilter(userStoreId),
      },
    });
    
    if (installments.length !== installmentIds.length) {
      throw new NotFoundException('Algunos pagos no fueron encontrados');
    }

    // Use the provided closing date or current date
    const targetClosingDate = closingDate ? new Date(closingDate) : new Date();
    
    // Normalize to midnight UTC to avoid timezone issues
    targetClosingDate.setUTCHours(0, 0, 0, 0);

    // Validate expenses if provided with store filtering
    if (expenseIds.length) {
      const expenses = await this.prisma.expense.findMany({
        where: { 
          id: { in: expenseIds },
          ...this.storeFilter(userStoreId),
        },
      });
      
      if (expenses.length !== expenseIds.length) {
        throw new NotFoundException('Algunos egresos no fueron encontrados');
      }
    }

    // Validate provider with store filtering
    const provider = await this.prisma.provider.findFirst({
      where: { 
        id: providerId,
        ...this.storeFilter(userStoreId),
      },
    });
    if (!provider) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const cashRegister = await this.prisma.cashRegister.create({
      data: {
        date: targetClosingDate,
        cashInRegister,
        cashFromTransfers,
        cashFromCards,
        notes,
        store: { connect: { id: storeId } },
        provider: { connect: { id: providerId } }, 
        createdBy: createdById ? { connect: { id: createdById } } : undefined,
        payments: {
          connect: installmentIds.map((id) => ({ id })),
        },
        expense: {
          connect: expenseIds.map((id) => ({ id })),
        },
      },
      include: {
        payments: true,
        expense: true,
      },
    });

    // Create cash denomination count record if provided
    if (denominationCounts && cashCounted !== undefined) {
      await this.prisma.cashDenominationCount.create({
        data: {
          cashRegisterId: cashRegister.id,
          storeId,
          totalCounted: cashCounted,
          systemCash: cashInRegister,
          difference: cashCounted - cashInRegister,
          bills_100000: denominationCounts.bills_100000 || 0,
          bills_50000: denominationCounts.bills_50000 || 0,
          bills_20000: denominationCounts.bills_20000 || 0,
          bills_10000: denominationCounts.bills_10000 || 0,
          bills_5000: denominationCounts.bills_5000 || 0,
          bills_2000: denominationCounts.bills_2000 || 0,
          bills_1000: denominationCounts.bills_1000 || 0,
          coins_500: denominationCounts.coins_500 || 0,
          coins_200: denominationCounts.coins_200 || 0,
          coins_100: denominationCounts.coins_100 || 0,
        },
      });
    }

    return cashRegister;
  }


  async findAll(filter: FilterCashRegisterDto, userStoreId: string | null): Promise<CashRegisterWithRelations[]> {
    let dateRange: { gte: Date; lte: Date } | undefined

    if (filter.date) {
      const start = new Date(filter.date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(filter.date)
      end.setHours(23, 59, 59, 999)
      dateRange = { gte: start, lte: end }
    }

    return this.prisma.cashRegister.findMany({
      where: {
        ...(dateRange && { date: dateRange }),
        ...this.storeFilter(userStoreId),
      },
      include: {
        payments: {
          include: {
            loan: {
              include: {
                user: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plate: true } },
              },
            },
            createdBy: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
        expense: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
        denominationCount: true,
      },
      orderBy: { date: "desc" },
    }) as Promise<CashRegisterWithRelations[]>
  }

  async findOne(id: string, userStoreId: string | null): Promise<FindOneCashRegisterResponseDto> {
    const cierre = await this.prisma.cashRegister.findFirst({
      where: { 
        id,
        ...this.storeFilter(userStoreId),
      },
      include: {
        payments: {
          include: {
            loan: {
              include: {
                user: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plate: true } },
              },
            },
            createdBy: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        expense: {
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
          },
        },
        denominationCount: true,
      },
    }) as CashRegisterWithRelations | null

    if (!cierre) {
      throw new NotFoundException("Cierre no encontrado")
    }

    // Validate store access
    await this.validateStoreAccess(cierre, userStoreId);

    return {
      id: cierre.id,
      date: cierre.date.toISOString(),
      cashInRegister: cierre.cashInRegister,
      cashFromTransfers: cierre.cashFromTransfers,
      cashFromCards: cierre.cashFromCards,
      notes: cierre.notes || undefined,
      createdAt: cierre.createdAt.toISOString(),
      updatedAt: cierre.updatedAt.toISOString(),
      createdBy: cierre.createdBy
        ? {
          id: cierre.createdBy.id,
          username: cierre.createdBy.username,
        }
        : undefined,
      payments: cierre.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        totalAmount: p.amount + p.gps,
        gpsAmount: p.gps,
        paymentDate: p.paymentDate.toISOString(),
        loan: {
          user: {
            id: p.loan.user.id,
            name: p.loan.user.name,
          },
          vehicle: {
            id: p.loan.vehicle.id,
            plate: p.loan.vehicle.plate,
          },
        },
        createdBy: p.createdBy
          ? {
            id: p.createdBy.id,
            username: p.createdBy.username,
          }
          : undefined,
      })),
      expense: cierre.expense.map((e) => ({
        id: e.id,
        amount: e.amount,
        date: e.date.toISOString(),
        category: e.category,
        paymentMethod: e.paymentMethod,
        beneficiary: e.beneficiary,
        reference: e.reference ?? undefined,
        description: e.description,
        attachmentUrl: e.attachmentUrl ?? undefined,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        createdBy: e.createdBy
          ? {
            id: e.createdBy.id,
            username: e.createdBy.username,
          }
          : undefined,
      })),
      denominationCount: cierre.denominationCount
        ? {
          bills_100000: cierre.denominationCount.bills_100000,
          bills_50000: cierre.denominationCount.bills_50000,
          bills_20000: cierre.denominationCount.bills_20000,
          bills_10000: cierre.denominationCount.bills_10000,
          bills_5000: cierre.denominationCount.bills_5000,
          bills_2000: cierre.denominationCount.bills_2000,
          bills_1000: cierre.denominationCount.bills_1000,
          coins_500: cierre.denominationCount.coins_500,
          coins_200: cierre.denominationCount.coins_200,
          coins_100: cierre.denominationCount.coins_100,
          totalCounted: cierre.denominationCount.totalCounted,
          systemCash: cierre.denominationCount.systemCash,
          difference: cierre.denominationCount.difference,
        }
        : undefined,
    }
  }

  async getUnassignedPayments(filter: FilterInstallmentsDto, userStoreId: string | null): Promise<{
    installments: InstallmentWithLoan[]
    expenses: Expense[]
  }> {
    const whereInstallments: Prisma.InstallmentWhereInput = {
      cashRegisterId: null,
      ...this.storeFilter(userStoreId),
    }

    if (filter.paymentMethod) {
      whereInstallments.paymentMethod = filter.paymentMethod
    }

    // If specificDate is provided, filter by exact date (ignoring time)
    if (filter.specificDate) {
      const targetDate = new Date(filter.specificDate)
      // Use UTC to avoid timezone issues
      const startOfDay = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        0, 0, 0, 0
      ))
      const endOfDay = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        23, 59, 59, 999
      ))

      console.log('🔍 Backend - Filtering installments by date:')
      console.log('   Input specificDate:', filter.specificDate)
      console.log('   Parsed targetDate:', targetDate)
      console.log('   Query range:', { startOfDay, endOfDay })

      whereInstallments.paymentDate = {
        gte: startOfDay,
        lte: endOfDay,
      }
    } else if (filter.startDate || filter.endDate) {
      whereInstallments.paymentDate = {}
      if (filter.startDate) {
        whereInstallments.paymentDate.gte = new Date(filter.startDate)
      }
      if (filter.endDate) {
        whereInstallments.paymentDate.lte = new Date(filter.endDate)
      }
    }

    const installments = await this.prisma.installment.findMany({
      where: whereInstallments,
      include: {
        loan: {
          include: {
            user: { select: { id: true, name: true } },
            vehicle: {
              include: {
                provider: true,
              },
            },
          },
        },
        createdBy: { select: { id: true, username: true } },
      },
      orderBy: { paymentDate: "asc" },
    }) as InstallmentWithLoan[]

    console.log('✅ Backend - Found installments:', installments.length)
    if (installments.length > 0) {
      console.log('   Sample payment dates:', installments.slice(0, 3).map(i => i.paymentDate))
      console.log('   Sample installment provider:', installments[0]?.loan?.vehicle?.provider)
      console.log('   Sample installment createdBy:', installments[0]?.createdBy)
    }

    const whereExpenses: Prisma.ExpenseWhereInput = {
      cashRegisterId: null,
      ...this.storeFilter(userStoreId),
    }

    // If specificDate is provided, filter expenses by exact date too
    if (filter.specificDate) {
      const targetDate = new Date(filter.specificDate)
      // Use UTC to avoid timezone issues
      const startOfDay = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        0, 0, 0, 0
      ))
      const endOfDay = new Date(Date.UTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        23, 59, 59, 999
      ))

      whereExpenses.date = {
        gte: startOfDay,
        lte: endOfDay,
      }
    } else if (filter.startDate || filter.endDate) {
      whereExpenses.date = {}
      if (filter.startDate) {
        whereExpenses.date.gte = new Date(filter.startDate)
      }
      if (filter.endDate) {
        whereExpenses.date.lte = new Date(filter.endDate)
      }
    }

    const expenses = await this.prisma.expense.findMany({
      where: whereExpenses,
      include: {
        provider: true,
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { date: "asc" },
    })

    return { installments, expenses }
  }

  async summary(dto: GetResumenDto, userStoreId: string | null) {
    const baseDate = dto.date ? new Date(dto.date) : new Date()

    const { startUtc: todayStart, endUtc: todayEnd } = getColombiaDayRange(baseDate)
    const { startUtc: yesterdayStart, endUtc: yesterdayEnd } = getColombiaDayRange(subDays(baseDate, 1))

    const [todayInstallments, yesterdayInstallments, todayExpenses] = await Promise.all([
      this.prisma.installment.findMany({
        where: {
          paymentDate: {
            gte: todayStart,
            lte: todayEnd,
          },
          ...this.storeFilter(userStoreId),
        },
        include: {
          loan: {
            select: {
              id: true,
              user: { select: { id: true, name: true } },
            },
          },
          createdBy: {
            select: {
              id: true,
              username: true,
            },
          },

        },
      }),
      this.prisma.installment.findMany({
        where: {
          paymentDate: {
            gte: yesterdayStart,
            lte: yesterdayEnd,
          },
          ...this.storeFilter(userStoreId),
        },
        include: {
          loan: {
            select: {
              id: true,
            },
          },
        },
      }),
      this.prisma.expense.findMany({
        where: {
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
          ...this.storeFilter(userStoreId),
        },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
    ])

    const sum = (arr: { amount: number; gps?: number }[]) =>
      arr.reduce((acc, item) => acc + item.amount + (item.gps || 0), 0)

    const totalIncome = sum(todayInstallments)
    const totalExpenses = sum(todayExpenses)
    const balance = totalIncome - totalExpenses

    const sumByMethod = (method: string) =>
      todayInstallments.filter((i) => i.paymentMethod === method).reduce((acc, i) => acc + i.amount + (i.gps || 0), 0)

    const paymentMethods = {
      cash: sumByMethod("CASH"),
      transfer: sumByMethod("TRANSACTION"),
      card: sumByMethod("CARD"),
      other: 0,
    }

    const expenseByCategory = todayExpenses.reduce(
      (acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
      },
      {} as Record<string, number>,
    )

    const expenseByMethod = todayExpenses.reduce(
      (acc, e) => {
        acc[e.paymentMethod] = (acc[e.paymentMethod] || 0) + e.amount
        return acc
      },
      {} as Record<string, number>,
    )

    const categories = {
      loanPayments: totalIncome,
      otherIncome: 0,
      expenses: expenseByCategory,
    }

    const previousTotal = sum(yesterdayInstallments)
    const previousDayComparison =
      previousTotal > 0 ? Math.round(((totalIncome - previousTotal) / previousTotal) * 100) : 100

    return {
      totalIncome,
      totalExpenses,
      balance,
      paymentMethods,
      expenseMethods: expenseByMethod,
      categories,
      previousDayComparison,
      allTodayInstallments: todayInstallments,
      allTodayExpenses: todayExpenses,
    }
  }

  async printClosing(id: string, userStoreId: string | null): Promise<Buffer> {
    const closing = await this.prisma.cashRegister.findFirst({
      where: { 
        id,
        ...this.storeFilter(userStoreId),
      },
      include: {
        provider: {
          select: { id: true, name: true },
        },
        payments: {
          include: {
            loan: {
              include: {
                user: { select: { id: true, name: true } },
                vehicle: { select: { id: true, plate: true } },
              },
            },
            createdBy: { select: { id: true, username: true } },
          },
        },
        expense: {
          include: {
            createdBy: { select: { id: true, username: true } },
          },
        },
        createdBy: { select: { id: true, username: true } },
      },
    }) as CashRegisterWithRelations | null;

    if (!closing) {
      throw new NotFoundException(`Closing with ID ${id} not found`);
    }

    // Validate store access
    await this.validateStoreAccess(closing, userStoreId);

    /* Totales -------------------------------------------------------------- */
    // Calcular por separado base y GPS
    const totalBasePayments = closing.payments.reduce(
      (acc, p) => acc + p.amount,
      0,
    );
    const totalGpsPayments = closing.payments.reduce(
      (acc, p) => acc + (p.gps ?? 0),
      0,
    );
    const totalPayments = totalBasePayments + totalGpsPayments;
    const totalExpenses = closing.expense.reduce((acc, e) => acc + e.amount, 0);
    const balance = totalPayments - totalExpenses;

    /* Agrupar -------------------------------------------------------------- */
    // Agrupar pagos base por método
    const basePaymentsByMethod = closing.payments.reduce<Record<string, number>>(
      (acc, p) => {
        acc[p.paymentMethod] = (acc[p.paymentMethod] ?? 0) + p.amount;
        return acc;
      },
      {},
    );

    // Agrupar GPS por método
    const gpsPaymentsByMethod = closing.payments.reduce<Record<string, number>>(
      (acc, p) => {
        if (p.gps && p.gps > 0) {
          acc[p.paymentMethod] = (acc[p.paymentMethod] ?? 0) + p.gps;
        }
        return acc;
      },
      {},
    );

    // Total combinado por método (para compatibilidad con código existente)
    const paymentsByMethod = closing.payments.reduce<Record<string, number>>(
      (acc, p) => {
        acc[p.paymentMethod] = (acc[p.paymentMethod] ?? 0) + p.amount + (p.gps ?? 0);
        return acc;
      },
      {},
    );

    const expensesByCategory = closing.expense.reduce<Record<string, number>>(
      (acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.amount;
        return acc;
      },
      {},
    );

    /* PDF ------------------------------------------------------------------ */
    const html = this.fillTemplate({
      id: closing.id,
      date: closing.date,
      provider: closing.provider.name,
      cashInRegister: closing.cashInRegister,
      cashFromTransfers: closing.cashFromTransfers,
      cashFromCards: closing.cashFromCards,
      notes: closing.notes,
      createdAt: closing.createdAt,
      updatedAt: closing.updatedAt,
      createdBy: closing.createdBy,
      payments: closing.payments,
      expense: closing.expense,
      totalPayments,
      totalBasePayments,
      totalGpsPayments,
      totalExpenses,
      balance,
      paymentsByMethod,
      basePaymentsByMethod,
      gpsPaymentsByMethod,
      expensesByCategory,
    });

    return this.generatePdf(html);
  }

  private async generatePdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      preferCSSPageSize: true,
    })

    await browser.close()
    return Buffer.from(pdfBuffer)
  }

  private fillTemplate(data: {
    id: string;
    date: Date;
    provider: string;
    cashInRegister: number;
    cashFromTransfers: number;
    cashFromCards: number;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: Pick<Employee, "id" | "username"> | null;
    payments: CashRegisterWithRelations['payments'];
    expense: CashRegisterWithRelations['expense'];
    totalPayments: number;
    totalBasePayments: number;
    totalGpsPayments: number;
    totalExpenses: number;
    balance: number;
    paymentsByMethod: Record<string, number>;
    basePaymentsByMethod: Record<string, number>;
    gpsPaymentsByMethod: Record<string, number>;
    expensesByCategory: Record<string, number>;
  }): string {
    const formattedData = {
      ...data,
      formattedDate: this.formatDateOnly(data.date), // Closing date (date only)
      formattedGeneratedDate: this.formatDate(data.createdAt), // When it was registered (with time)
      formattedTotalPayments: this.formatCurrency(data.totalPayments),
      formattedTotalBasePayments: this.formatCurrency(data.totalBasePayments),
      formattedTotalGpsPayments: this.formatCurrency(data.totalGpsPayments),
      formattedTotalExpenses: this.formatCurrency(data.totalExpenses),
      formattedBalance: this.formatCurrency(data.balance),
      provider: data.provider,
      formattedCashInRegister: this.formatCurrency(data.cashInRegister),
      formattedCashFromTransfers: this.formatCurrency(data.cashFromTransfers),
      formattedCashFromCards: this.formatCurrency(data.cashFromCards),
      createdBy: data.createdBy?.username || 'Sistema',
      paymentMethods: this.generatePaymentMethodsHtml(data.paymentsByMethod),
      basePaymentMethods: this.generatePaymentMethodsHtml(data.basePaymentsByMethod),
      gpsPaymentMethods: this.generatePaymentMethodsHtml(data.gpsPaymentsByMethod),
      expenseCategories: this.generateExpenseCategoriesHtml(data.expensesByCategory),
      paymentRows: this.generatePaymentRowsHtml(data.payments),
      expenseRows: this.generateExpenseRowsHtml(data.expense),
    }

    let result = templateHtml
      .replace(/{{id}}/g, formattedData.id)
      .replace(/{{provider}}/g, formattedData.provider)
      .replace(/{{formattedDate}}/g, formattedData.formattedDate)
      .replace(/{{formattedGeneratedDate}}/g, formattedData.formattedGeneratedDate)
      .replace(/{{createdBy}}/g, formattedData.createdBy)
      .replace(/{{formattedTotalPayments}}/g, formattedData.formattedTotalPayments)
      .replace(/{{formattedTotalBasePayments}}/g, formattedData.formattedTotalBasePayments)
      .replace(/{{formattedTotalGpsPayments}}/g, formattedData.formattedTotalGpsPayments)
      .replace(/{{formattedTotalExpenses}}/g, formattedData.formattedTotalExpenses)
      .replace(/{{formattedBalance}}/g, formattedData.formattedBalance)
      .replace(/{{formattedCashInRegister}}/g, formattedData.formattedCashInRegister)
      .replace(/{{formattedCashFromTransfers}}/g, formattedData.formattedCashFromTransfers)
      .replace(/{{formattedCashFromCards}}/g, formattedData.formattedCashFromCards)
      .replace(/{{paymentMethods}}/g, formattedData.paymentMethods)
      .replace(/{{basePaymentMethods}}/g, formattedData.basePaymentMethods)
      .replace(/{{gpsPaymentMethods}}/g, formattedData.gpsPaymentMethods)
      .replace(/{{expenseCategories}}/g, formattedData.expenseCategories)
      .replace(/{{paymentRows}}/g, formattedData.paymentRows)
      .replace(/{{expenseRows}}/g, formattedData.expenseRows)

    if (data.notes) {
      result = result.replace(/{{#if notes}}([\s\S]*?){{\/if}}/g, '$1')
      result = result.replace(/{{notes}}/g, data.notes)
    } else {
      result = result.replace(/{{#if notes}}[\s\S]*?{{\/if}}/g, '')
    }

    return result
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value)
  }

  private formatDate(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return "—"
    const timeZone = "America/Bogota"

    const raw = typeof dateInput === "string" ? dateInput : dateInput.toISOString()
    const utcDate = new Date(raw.endsWith("Z") ? raw : `${raw}Z`)
    const zoned = utcToZonedTime(utcDate, timeZone)

    return format(zoned, "dd 'de' MMMM 'de' yyyy, hh:mm aaaa", { timeZone })
  }

  private formatDateOnly(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return "—"
    
    // Parse UTC date and format as date only (no time, no timezone conversion)
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()
    const day = date.getUTCDate()
    
    // Create a local date with the UTC components to avoid timezone shift
    const localDate = new Date(year, month, day)
    
    return format(localDate, "dd 'de' MMMM 'de' yyyy", { locale: es })
  }

  private generatePaymentMethodsHtml(methods: Record<string, number>): string {
    return Object.entries(methods).map(([method, amount]) => {
      const readableMethod = this.getReadablePaymentMethod(method)
      return `
        <div class="method-box">
          <div class="method-name">${readableMethod}</div>
          <div class="amount">${this.formatCurrency(amount)}</div>
        </div>
      `
    }).join('')
  }

  private generateExpenseCategoriesHtml(categories: Record<string, number>): string {
    return Object.entries(categories).map(([category, amount]) => {
      const readableCategory = this.getReadableExpenseCategory(category)
      return `
        <div class="category-box">
          <div class="category-name">${readableCategory}</div>
          <div class="amount">${this.formatCurrency(amount)}</div>
        </div>
      `
    }).join('')
  }

  private generatePaymentRowsHtml(payments: CashRegisterWithRelations['payments']): string {
    return payments.map(payment => {
      // Use the closing date: latePaymentDate for late payments, paymentDate for on-time
      const closingDate = payment.isLate && payment.latePaymentDate 
        ? payment.latePaymentDate 
        : payment.paymentDate
      
      return `
        <tr>
          <td>${payment.loan.user.name}</td>
          <td>${payment.loan.vehicle.plate}</td>
          <td>${this.formatDateOnly(closingDate)}</td>
          <td>${this.getReadablePaymentMethod(payment.paymentMethod)}</td>
          <td class="right">${this.formatCurrency(payment.amount)}</td>
          <td class="right">${this.formatCurrency(payment.gps || 0)}</td>
          <td class="right">${this.formatCurrency(payment.amount + (payment.gps || 0))}</td>
        </tr>
      `
    }).join('')
  }

  private generateExpenseRowsHtml(expenses: CashRegisterWithRelations['expense']): string {
    return expenses.map(expense => {
      return `
        <tr>
          <td>${this.getReadableExpenseCategory(expense.category)}</td>
          <td>${expense.beneficiary}</td>
          <td>${this.formatDateOnly(expense.date)}</td>
          <td>${this.getReadablePaymentMethod(expense.paymentMethod)}</td>
          <td class="right">${this.formatCurrency(expense.amount)}</td>
        </tr>
      `
    }).join('')
  }

  private getReadablePaymentMethod(method: string): string {
    const methods: Record<string, string> = {
      'CASH': 'Efectivo',
      'TRANSACTION': 'Transferencia',
      'CARD': 'Tarjeta',
      'OTHER': 'Otro'
    }
    return methods[method] || method
  }

  private getReadableExpenseCategory(category: string): string {
    const categories: Record<string, string> = {
      'FUEL': 'Combustible',
      'MAINTENANCE': 'Mantenimiento',
      'SALARY': 'Salario',
      'RENT': 'Alquiler',
      'UTILITIES': 'Servicios',
      'OTHER': 'Otro'
    }
    return categories[category] || category
  }
}

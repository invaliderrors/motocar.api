import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CalculatePaymentCoverageDto, CreateInstallmentDto, FindInstallmentFiltersDto, UpdateInstallmentDto } from './installment.dto';
import { toColombiaMidnightUtc, toColombiaEndOfDayUtc, toColombiaUtc } from 'src/lib/dates';
import { addDays, differenceInDays, startOfDay, isSameDay } from 'date-fns';
import { BaseStoreService } from 'src/lib/base-store.service';
import { LoanStatus, Prisma } from 'src/prisma/generated/client';
import { NewsService } from '../news/news.service';

@Injectable()
export class InstallmentService extends BaseStoreService {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly newsService: NewsService,
  ) {
    super(prisma);
  }

  /**
   * Calculate the last covered date for a loan based on payments made.
   * This is the date up to which all payments have covered the daily rate.
   * 
   * IMPORTANT: The downPayment is treated as prepaid installments. If a loan
   * has a downPayment, that amount covers a certain number of days from the
   * start date, so the user doesn't owe from day 1.
   */
  private async getLastCoveredDate(loanId: string, loan: any): Promise<Date> {
    // Get all existing payments for this loan
    const existingPayments = await this.prisma.installment.findMany({
      where: { loanId },
      orderBy: { createdAt: 'asc' },
    });

    const dailyRate = loan.installmentPaymentAmmount;
    const loanStartDate = startOfDay(new Date(loan.startDate));
    const downPayment = loan.downPayment || 0;

    // Calculate days covered by the down payment
    // The down payment acts as prepaid installments from the start date
    let daysCoveredByDownPayment = 0;
    if (dailyRate > 0 && downPayment > 0) {
      daysCoveredByDownPayment = Math.floor(downPayment / dailyRate);
    }

    if (existingPayments.length === 0) {
      // No payments yet
      if (daysCoveredByDownPayment > 0) {
        // Down payment covers some days, so last covered date is start date + days covered - 1
        return addDays(loanStartDate, daysCoveredByDownPayment - 1);
      }
      // No down payment, last covered date is the day before the loan started
      return addDays(loanStartDate, -1);
    }

    // Calculate total days covered by all payments
    let totalDaysCovered = daysCoveredByDownPayment;
    for (const payment of existingPayments) {
      const daysCovered = payment.amount / dailyRate;
      totalDaysCovered += daysCovered;
    }

    // Last covered date is loan start date + total days covered - 1
    // (because if you pay for 1 day starting from Nov 15, you cover Nov 15)
    return addDays(loanStartDate, Math.floor(totalDaysCovered) - 1);
  }

  /**
   * Calculate payment coverage information based on the amount paid.
   * Returns the date range this payment covers and whether it's late.
   */
  private calculatePaymentCoverage(
    paymentAmount: number,
    dailyRate: number,
    lastCoveredDate: Date,
    paymentDate: Date,
  ): {
    daysCovered: number;
    coverageStartDate: Date;
    coverageEndDate: Date;
    isLate: boolean;
    latePaymentDate: Date | null;
  } {
    // Calculate how many days this payment covers
    const daysCovered = paymentAmount / dailyRate;

    // Coverage starts the day after the last covered date
    const coverageStartDate = addDays(lastCoveredDate, 1);
    
    // Coverage ends after the days covered (fractional days round down for the end date)
    const coverageEndDate = addDays(coverageStartDate, Math.floor(daysCovered) - 1);

    // Payment is late if the coverage start date is before today
    const today = startOfDay(new Date());
    const isLate = coverageStartDate < today;

    // If late, the latePaymentDate is the coverage start date (when it should have been paid)
    const latePaymentDate = isLate ? coverageStartDate : null;

    return {
      daysCovered,
      coverageStartDate,
      coverageEndDate,
      isLate,
      latePaymentDate,
    };
  }

  /**
   * Helper to check if a date is in the skipped dates list
   */
  private isDateSkipped(date: Date, skippedDates: Date[]): boolean {
    return skippedDates.some(skippedDate => isSameDay(date, skippedDate));
  }

  /**
   * Count how many skipped dates fall between two dates (inclusive)
   */
  private countSkippedDatesInRange(startDate: Date, endDate: Date, skippedDates: Date[]): number {
    const start = startOfDay(startDate);
    const end = startOfDay(endDate);
    
    return skippedDates.filter(skippedDate => {
      const date = startOfDay(skippedDate);
      return date >= start && date <= end;
    }).length;
  }

  /**
   * Calculate the effective days between two dates, excluding skipped dates
   */
  private calculateEffectiveDays(startDate: Date, endDate: Date, skippedDates: Date[]): number {
    const totalDays = differenceInDays(endDate, startDate);
    const skippedCount = this.countSkippedDatesInRange(startDate, endDate, skippedDates);
    return Math.max(0, totalDays - skippedCount);
  }

  /**
   * Public endpoint to calculate payment coverage before submitting.
   * This helps the frontend show the user what dates their payment will cover.
   * Now includes skipped dates from news (store closures, holidays, etc.)
   */
  async calculateCoverage(dto: CalculatePaymentCoverageDto) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: dto.loanId },
    });

    if (!loan) throw new NotFoundException('Loan not found');

    // Fetch skipped dates for this loan (from news)
    let skippedDates: Date[] = [];
    try {
      const skippedDatesData = await this.newsService.getSkippedDatesForLoan(dto.loanId);
      skippedDates = skippedDatesData.dates.map(d => startOfDay(new Date(d)));
    } catch (error) {
      console.error('Error fetching skipped dates for coverage calculation:', error);
      // Continue without skipped dates if there's an error
    }

    const dailyRate = loan.installmentPaymentAmmount;
    const lastCoveredDate = await this.getLastCoveredDate(dto.loanId, loan);
    const today = startOfDay(new Date());

    // Calculate coverage considering skipped dates
    const coverage = this.calculatePaymentCoverageWithSkippedDates(
      dto.amount,
      dailyRate,
      lastCoveredDate,
      today,
      skippedDates,
    );

    // Calculate days behind/ahead, excluding skipped dates
    const effectiveDaysFromLastCoveredToToday = this.calculateEffectiveDays(lastCoveredDate, today, skippedDates);
    const daysBehind = Math.max(0, effectiveDaysFromLastCoveredToToday - 1); // -1 because lastCoveredDate is already paid
    
    // Calculate amount needed to catch up to today (only for non-skipped days)
    const amountNeededToCatchUp = daysBehind * dailyRate;

    // Count skipped dates in the period for UI display
    const skippedDatesInPeriod = this.countSkippedDatesInRange(lastCoveredDate, today, skippedDates);

    return {
      loanId: dto.loanId,
      dailyRate,
      loanStartDate: loan.startDate,
      lastCoveredDate,
      paymentAmount: dto.amount,
      daysCovered: coverage.daysCovered,
      coverageStartDate: coverage.coverageStartDate,
      coverageEndDate: coverage.coverageEndDate,
      isLate: coverage.isLate,
      latePaymentDate: coverage.latePaymentDate,
      daysBehind,
      amountNeededToCatchUp,
      // Additional useful info
      willBeCurrentAfterPayment: dto.amount >= amountNeededToCatchUp,
      daysAheadAfterPayment: coverage.daysCovered - daysBehind,
      // Skipped dates info
      skippedDatesCount: skippedDatesInPeriod,
      skippedDates: skippedDates.slice(0, 10).map(d => d.toISOString()), // Return first 10 for display
    };
  }

  /**
   * Calculate payment coverage with skipped dates consideration.
   * The coverage end date will skip over any dates that should not be charged.
   */
  private calculatePaymentCoverageWithSkippedDates(
    paymentAmount: number,
    dailyRate: number,
    lastCoveredDate: Date,
    paymentDate: Date,
    skippedDates: Date[],
  ): {
    daysCovered: number;
    coverageStartDate: Date;
    coverageEndDate: Date;
    isLate: boolean;
    latePaymentDate: Date | null;
  } {
    // Calculate how many effective days this payment covers
    const daysCovered = Math.floor(paymentAmount / dailyRate);

    // Coverage starts the day after the last covered date
    let coverageStartDate = addDays(lastCoveredDate, 1);
    
    // Skip over any skipped dates at the start
    while (this.isDateSkipped(coverageStartDate, skippedDates)) {
      coverageStartDate = addDays(coverageStartDate, 1);
    }

    // Calculate coverage end date, skipping over skipped dates
    let effectiveDaysCounted = 0;
    let currentDate = new Date(coverageStartDate);
    
    while (effectiveDaysCounted < daysCovered) {
      if (!this.isDateSkipped(currentDate, skippedDates)) {
        effectiveDaysCounted++;
      }
      if (effectiveDaysCounted < daysCovered) {
        currentDate = addDays(currentDate, 1);
      }
    }
    
    const coverageEndDate = currentDate;

    // Payment is late if the coverage start date is before today
    const today = startOfDay(paymentDate);
    const isLate = coverageStartDate < today;

    // If late, the latePaymentDate is the coverage start date (when it should have been paid)
    const latePaymentDate = isLate ? coverageStartDate : null;

    return {
      daysCovered,
      coverageStartDate,
      coverageEndDate,
      isLate,
      latePaymentDate,
    };
  }

  async create(dto: CreateInstallmentDto, userStoreId: string | null) {
    // If storeId is not in DTO, use the authenticated user's storeId
    const storeId = dto.storeId || userStoreId;
    
    if (!storeId) {
      throw new BadRequestException('Store ID is required to create an installment');
    }

    const loan = await this.prisma.loan.findUnique({
      where: { id: dto.loanId },
    });

    if (!loan) throw new NotFoundException('Loan not found');

    if (
      loan.status === LoanStatus.COMPLETED ||
      loan.status === LoanStatus.DEFAULTED
    ) {
      throw new BadRequestException(
        `Loan status is ${loan.status}. No more payments allowed.`,
      );
    }

    if (dto.amount > loan.debtRemaining) {
      throw new BadRequestException('Payment amount exceeds remaining debt.');
    }

    // Get the daily payment rate
    const dailyRate = loan.installmentPaymentAmmount;
    
    // Get the last covered date for this loan
    const lastCoveredDate = await this.getLastCoveredDate(dto.loanId, loan);
    
    // Fetch skipped dates for this loan (from news)
    let skippedDates: Date[] = [];
    try {
      const skippedDatesData = await this.newsService.getSkippedDatesForLoan(dto.loanId);
      skippedDates = skippedDatesData.dates.map(d => startOfDay(new Date(d)));
    } catch (error) {
      console.error('Error fetching skipped dates for installment creation:', error);
      // Continue without skipped dates if there's an error
    }
    
    // Calculate payment coverage based on amount, considering skipped dates
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const coverage = this.calculatePaymentCoverageWithSkippedDates(
      dto.amount,
      dailyRate,
      lastCoveredDate,
      paymentDate,
      skippedDates,
    );

    // Determine if late/advance: use automatic calculation if not explicitly provided
    const isLate = dto.isLate !== undefined ? dto.isLate : coverage.isLate;
    const latePaymentDate = dto.latePaymentDate 
      ? toColombiaUtc(dto.latePaymentDate) 
      : (coverage.latePaymentDate ? toColombiaUtc(coverage.latePaymentDate) : null);

    // For advance payments, check if coverage end date is after today
    const today = startOfDay(new Date());
    const isAdvance = dto.isAdvance !== undefined 
      ? dto.isAdvance 
      : (coverage.coverageEndDate > today);
    const advancePaymentDate = dto.advancePaymentDate 
      ? toColombiaUtc(dto.advancePaymentDate) 
      : (isAdvance ? toColombiaUtc(coverage.coverageEndDate) : null);

    const installment = await this.prisma.installment.create({
      data: {
        store: { connect: { id: storeId } },
        loan: { connect: { id: dto.loanId } },
        amount: dto.amount,
        gps: dto.gps,
        paymentDate: toColombiaUtc(paymentDate),
        latePaymentDate: latePaymentDate,
        isAdvance: isAdvance,
        advancePaymentDate: advancePaymentDate,
        notes: dto.notes,
        paymentMethod: dto.paymentMethod,
        isLate: isLate,
        attachmentUrl: dto.attachmentUrl,
        createdAt: toColombiaUtc(new Date()),
        updatedAt: toColombiaUtc(new Date()),
        createdBy: dto.createdById ? { connect: { id: dto.createdById } } : undefined,
      },
    });

    // Calculate fractional installments based on payment amount
    // If customer pays 20,000 and installment is 25,000, this counts as 0.8 installments
    const installmentAmount = loan.installmentPaymentAmmount || (loan.debtRemaining / loan.remainingInstallments);
    const fractionalInstallmentsPaid = dto.amount / installmentAmount;
    
    const updatedPaid = loan.paidInstallments + fractionalInstallmentsPaid;
    const updatedRemaining = Math.max(0, loan.installments - updatedPaid);
    const updatedTotalPaid = loan.totalPaid + dto.amount;
    const updatedDebt = Math.max(0, loan.debtRemaining - dto.amount);

    const newStatus =
      updatedDebt <= 0 || updatedRemaining <= 0
        ? LoanStatus.COMPLETED
        : LoanStatus.ACTIVE;

    await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        paidInstallments: updatedPaid,
        remainingInstallments: updatedRemaining,
        totalPaid: updatedTotalPaid,
        debtRemaining: updatedDebt,
        status: newStatus,
      },
    });

    return installment;
  }

  async findAll(filters: FindInstallmentFiltersDto, userStoreId: string | null) {
    const { 
      startDate, 
      endDate, 
      plate, 
      userId, 
      loanId, 
      vehicleType, 
      paymentMethod, 
      isLate,
      minAmount,
      maxAmount,
      page = 1, 
      limit = 50 
    } = filters;
    
    const where: Prisma.InstallmentWhereInput = {
      ...this.storeFilter(userStoreId),
    };

    // Date filters
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) {
        where.paymentDate.gte = toColombiaMidnightUtc(startDate);
      }
      if (endDate) {
        const extendedEndDate = addDays(new Date(endDate), 1);
        where.paymentDate.lte = toColombiaEndOfDayUtc(extendedEndDate);
      }
    }

    // Amount filters
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) {
        where.amount.gte = minAmount;
      }
      if (maxAmount !== undefined) {
        where.amount.lte = maxAmount;
      }
    }

    // Payment method filter
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    // Late payment filter
    if (isLate !== undefined) {
      where.isLate = isLate;
    }

    // Loan filters
    if (loanId || userId || plate || vehicleType) {
      where.loan = {};
      
      if (loanId) {
        where.loan.id = loanId;
      }
      
      if (userId) {
        where.loan.userId = userId;
      }

      if (plate || vehicleType) {
        where.loan.vehicle = {};
        
        if (plate) {
          where.loan.vehicle.plate = {
            contains: plate,
            mode: 'insensitive',
          };
        }
        
        if (vehicleType) {
          where.loan.vehicle.vehicleType = vehicleType;
        }
      }
    }

    // Always exclude installments that belong to archived loans
    if (!where.loan) {
      where.loan = {};
    }
    where.loan.archived = false;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.installment.findMany({
        where,
        include: {
          loan: {
            include: {
              user: true,
              vehicle: {
                include: {
                  provider: true,
                }
              }
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
        orderBy: [
          { createdAt: 'desc' },
          { paymentDate: 'desc' }
        ],
        skip,
        take: limit,
      }),
      this.prisma.installment.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllRaw(): Promise<Installment[]> {
    return this.prisma.installment.findMany({
      include: {
        loan: {
          include: {
            user: true,
            vehicle: {
              include: {
                provider: true,
              }
            }
          },
        },
        createdBy: true,
      },
    })
  }


  async findOne(id: string, userStoreId: string | null) {
    const record = await this.prisma.installment.findUnique({
      where: { id },
      include: {
        loan: {
          include: {
            user: true,
            vehicle: true,
          }
        },
        createdBy: true,
      },
    });

    if (!record) throw new NotFoundException('Installment not found');
    
    // Validate store access
    this.validateStoreAccess(record, userStoreId);
    
    return record;
  }


  async update(id: string, dto: UpdateInstallmentDto, userStoreId: string | null) {
    console.log('📅 Received update DTO:', {
      id,
      paymentDate: dto.paymentDate,
      latePaymentDate: dto.latePaymentDate,
      fullDto: dto
    });

    await this.findOne(id, userStoreId);

    const { loanId, createdById, paymentDate, latePaymentDate, ...rest } = dto;

    const updateData: any = {
      ...rest,
      updatedAt: toColombiaUtc(new Date()),
    };

    // Handle paymentDate - convert to Colombia UTC if provided
    if (paymentDate !== undefined) {
      updateData.paymentDate = toColombiaUtc(paymentDate);
      console.log('📅 Converting paymentDate:', {
        original: paymentDate,
        converted: updateData.paymentDate
      });
    }

    // Handle latePaymentDate - convert to Colombia UTC if provided, null if explicitly null
    if (latePaymentDate !== undefined) {
      updateData.latePaymentDate = latePaymentDate ? toColombiaUtc(latePaymentDate) : null;
    }

    // Handle createdBy relationship if provided
    if (createdById) {
      updateData.createdBy = { connect: { id: createdById } };
    }

    console.log('📅 Final update data:', updateData);

    return this.prisma.installment.update({
      where: { id },
      data: updateData,
    });

  }

  async remove(id: string, userStoreId: string | null) {
    const installment = await this.findOne(id, userStoreId);

    // Get the loan to update its totals
    const loan = await this.prisma.loan.findUnique({
      where: { id: installment.loanId },
    });

    if (!loan) {
      throw new NotFoundException(`Loan not found for installment ${id}`);
    }

    // Delete the installment
    await this.prisma.installment.delete({
      where: { id },
    });

    // Calculate fractional installments to subtract
    const installmentAmount = loan.installmentPaymentAmmount || (loan.debtRemaining / loan.remainingInstallments);
    const fractionalInstallmentsPaid = installment.amount / installmentAmount;
    
    // Update loan totals by reversing the installment payment
    const updatedPaid = Math.max(0, loan.paidInstallments - fractionalInstallmentsPaid);
    const updatedRemaining = loan.installments - updatedPaid;
    const updatedTotalPaid = Math.max(0, loan.totalPaid - installment.amount);
    const updatedDebt = loan.debtRemaining + installment.amount;

    // Recalculate status - if debt is restored, loan should be ACTIVE again
    const newStatus =
      updatedDebt <= 0 || updatedRemaining <= 0
        ? LoanStatus.COMPLETED
        : LoanStatus.ACTIVE;

    await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        paidInstallments: updatedPaid,
        remainingInstallments: updatedRemaining,
        totalPaid: updatedTotalPaid,
        debtRemaining: updatedDebt,
        status: newStatus,
      },
    });

    return installment;
  }
}

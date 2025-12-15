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

// Constants for 30-day month calculations
const DAYS_PER_MONTH = 30;

@Injectable()
export class InstallmentService extends BaseStoreService {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly newsService: NewsService,
  ) {
    super(prisma);
  }

  /**
   * Add logical days to a date using the 30-day-per-month convention.
   * This ensures consistent calculations: 1 month = 30 days exactly.
   * 
   * IMPORTANT: Days 31 are normalized to day 30 (since we use 30-day months)
   * 
   * For example, May 31 + 194 days:
   * - First normalize: May 31 → May 30 (day 0 remaining in month)
   * - Move to June 1, then 194 - 1 = 193 days remaining
   * - June 1 + 193 days = December 14
   */
  private addLogicalDays(startDate: Date, daysToAdd: number): Date {
    if (daysToAdd <= 0) return startDate;
    
    const date = new Date(startDate);
    let remainingDays = daysToAdd;
    
    // Normalize: if current day is 31, treat it as day 30 (end of month in 30-day system)
    let currentDay = date.getDate();
    if (currentDay > DAYS_PER_MONTH) {
      currentDay = DAYS_PER_MONTH;
      date.setDate(DAYS_PER_MONTH);
    }
    
    // Calculate remaining days in the current month (using 30-day month)
    const daysLeftInMonth = DAYS_PER_MONTH - currentDay;
    
    if (remainingDays <= daysLeftInMonth) {
      // All days fit in the current month
      date.setDate(currentDay + remainingDays);
      return date;
    }
    
    // Move to the first day of next month
    remainingDays -= (daysLeftInMonth + 1); // +1 to account for moving to day 1 of next month
    date.setMonth(date.getMonth() + 1);
    date.setDate(1);
    
    // Add full months
    const fullMonths = Math.floor(remainingDays / DAYS_PER_MONTH);
    remainingDays = remainingDays % DAYS_PER_MONTH;
    
    // Move forward by full months
    if (fullMonths > 0) {
      date.setMonth(date.getMonth() + fullMonths);
    }
    
    // Add remaining days
    if (remainingDays > 0) {
      date.setDate(date.getDate() + remainingDays);
    }
    
    return date;
  }

  /**
   * Calculate the logical difference in days between two dates using 30-day months.
   * This is the inverse of addLogicalDays.
   * Returns negative values when endDate is before startDate.
   */
  private getLogicalDaysDifference(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Determine direction
    const isNegative = endDate < startDate;
    const [earlierDate, laterDate] = isNegative ? [end, start] : [start, end];
    
    // Calculate the difference in months and days
    let months = (laterDate.getFullYear() - earlierDate.getFullYear()) * 12 + (laterDate.getMonth() - earlierDate.getMonth());
    let days = laterDate.getDate() - earlierDate.getDate();
    
    // If later day is less than earlier day, we borrowed a month
    if (days < 0) {
      months -= 1;
      days += DAYS_PER_MONTH;
    }
    
    const result = (months * DAYS_PER_MONTH) + days;
    return isNegative ? -result : result;
  }

  /**
   * Calculate the last covered date for a loan based on payments made.
   * This is the date up to which all payments have covered the daily rate.
   * 
   * IMPORTANT: The downPayment is treated as prepaid installments. If a loan
   * has a downPayment, that amount covers a certain number of days from the
   * start date, so the user doesn't owe from day 1.
   * 
   * @param excludeInstallmentId - If provided, excludes this installment from calculation (for editing)
   */
  private async getLastCoveredDate(loanId: string, loan: any, excludeInstallmentId?: string): Promise<Date> {
    // Get all existing payments for this loan
    const existingPayments = await this.prisma.installment.findMany({
      where: { 
        loanId,
        // Exclude the installment being edited if provided
        ...(excludeInstallmentId ? { id: { not: excludeInstallmentId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch skipped dates for this loan (from news)
    let skippedDates: Date[] = [];
    try {
      const skippedDatesData = await this.newsService.getSkippedDatesForLoan(loanId);
      skippedDates = skippedDatesData.dates.map(d => startOfDay(new Date(d)));
    } catch (error) {
      console.error('Error fetching skipped dates for last covered date calculation:', error);
      // Continue without skipped dates if there's an error
    }

    // Use TOTAL daily rate (base + gps) for coverage calculation
    const baseDailyRate = loan.installmentPaymentAmmount || 0;
    const gpsDailyRate = loan.gpsInstallmentPayment || 0;
    const totalDailyRate = baseDailyRate + gpsDailyRate;
    
    // Use Colombia timezone for loan start date
    const loanStartDate = startOfDay(toColombiaUtc(new Date(loan.startDate)));
    const downPayment = loan.downPayment || 0;

    // Calculate days covered by the down payment (keep fractional)
    // The down payment acts as prepaid installments from the start date
    let daysCoveredByDownPayment = 0;
    if (totalDailyRate > 0 && downPayment > 0) {
      daysCoveredByDownPayment = downPayment / totalDailyRate;
    }

    // Calculate total WORKING days covered by all payments (base + gps)
    let totalWorkingDaysCovered = daysCoveredByDownPayment;
    for (const payment of existingPayments) {
      // Each payment's total = amount (base) + gps
      const totalPayment = (payment.amount || 0) + (payment.gps || 0);
      const daysCovered = totalPayment / totalDailyRate;
      totalWorkingDaysCovered += daysCovered;
    }

    if (totalWorkingDaysCovered === 0) {
      // No coverage at all
      return loanStartDate;
    }

    // Now we need to find the date that corresponds to totalWorkingDaysCovered
    // working days from the loan start date, using LOGICAL DAYS (30-day months)
    // and accounting for skipped dates
    const fullDaysToCount = Math.floor(totalWorkingDaysCovered);

    console.log('🔍 getLastCoveredDate calculation:', {
      loanId,
      loanStartDate: loanStartDate.toISOString(),
      totalWorkingDaysCovered,
      fullDaysToCount,
      skippedDatesCount: skippedDates.length,
      downPayment,
      totalDailyRate,
      daysCoveredByDownPayment,
    });

    // Use addLogicalDays to add the full days using 30-day month logic
    // This ensures consistency with coverage calculations
    let lastCoveredDate = this.addLogicalDays(loanStartDate, fullDaysToCount);
    
    // Now adjust for skipped dates by extending the coverage
    // Count how many skipped dates fall between loanStartDate and lastCoveredDate
    const skippedInRange = this.countSkippedDatesInRange(loanStartDate, lastCoveredDate, skippedDates);
    if (skippedInRange > 0) {
      // Extend coverage by the number of skipped dates
      lastCoveredDate = this.addLogicalDays(lastCoveredDate, skippedInRange);
    }

    console.log('🔍 getLastCoveredDate result:', {
      lastCoveredDate: lastCoveredDate.toISOString(),
      fullDaysToCount,
      totalWorkingDaysCovered,
      fractionalPart: totalWorkingDaysCovered - fullDaysToCount,
      skippedInRange,
    });

    return lastCoveredDate;
  }

  /**
   * Calculate payment coverage information based on the amount paid.
   * Returns the date range this payment covers and whether it's late.
   * Uses 30-day months for consistent date calculations.
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
    
    // Coverage ends after the days covered using logical days (30-day months)
    // (fractional days round down for the end date)
    const coverageEndDate = this.addLogicalDays(coverageStartDate, Math.floor(daysCovered) - 1);

    // Payment is late if the coverage start date is before or equal to today
    // Because if today = Dec 15 and loan is only covered until Dec 14,
    // the payment should start covering Dec 15 (today), which means it's late
    const today = startOfDay(new Date());
    const isLate = coverageStartDate <= today;

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
   * Calculate the effective days between two dates, excluding skipped dates.
   * Uses 30-day months for consistent calculation.
   * Returns negative values when startDate is after endDate (user is ahead).
   */
  private calculateEffectiveDays(startDate: Date, endDate: Date, skippedDates: Date[]): number {
    // Use logical days (30-day months) instead of actual calendar days
    const totalDays = this.getLogicalDaysDifference(startDate, endDate);
    const skippedCount = this.countSkippedDatesInRange(startDate, endDate, skippedDates);
    return totalDays - skippedCount;
  }

  /**
   * Public endpoint to calculate payment coverage before submitting.
   * This helps the frontend show the user what dates their payment will cover.
   * Now includes skipped dates from news (store closures, holidays, etc.)
   * 
   * NOTE: dto.amount should be the TOTAL payment (base + gps) from the frontend
   * NOTE: dto.excludeInstallmentId is used when editing an installment to exclude it from calculation
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

    // Use TOTAL daily rate (base + gps) for coverage calculation
    const baseDailyRate = loan.installmentPaymentAmmount || 0;
    const gpsDailyRate = loan.gpsInstallmentPayment || 0;
    const totalDailyRate = baseDailyRate + gpsDailyRate;
    
    // Pass excludeInstallmentId to exclude the installment being edited
    const lastCoveredDate = await this.getLastCoveredDate(dto.loanId, loan, dto.excludeInstallmentId);
    // Use Colombia time for "today" calculation
    const today = startOfDay(toColombiaUtc(new Date()));

    // Calculate coverage considering skipped dates
    // dto.amount is the TOTAL payment amount (base + gps)
    const coverage = this.calculatePaymentCoverageWithSkippedDates(
      dto.amount,
      totalDailyRate,
      lastCoveredDate,
      today,
      skippedDates,
    );

    // Calculate days behind/ahead, excluding skipped dates
    // effectiveDaysFromLastCoveredToToday = days from lastCoveredDate to today (inclusive)
    // If lastCoveredDate = Dec 14 and today = Dec 15, effectiveDays = 1 (owes Dec 15)
    // If lastCoveredDate = Dec 15 and today = Dec 15, effectiveDays = 0 (up to date - paid through today)
    // NOTE: "Up to date" means paid THROUGH today, not just TO today
    const effectiveDaysFromLastCoveredToToday = this.calculateEffectiveDays(lastCoveredDate, today, skippedDates);
    const daysBehind = Math.max(0, effectiveDaysFromLastCoveredToToday);
    
    console.log('📊 Payment coverage calculation:', {
      loanId: dto.loanId,
      lastCoveredDate: lastCoveredDate.toISOString(),
      today: today.toISOString(),
      effectiveDaysFromLastCoveredToToday,
      daysBehind,
      paymentDaysCovered: coverage.daysCovered,
      willBeAheadAfterPayment: coverage.daysCovered - daysBehind,
    });
    
    // Calculate amount needed to catch up to today (only for non-skipped days)
    const amountNeededToCatchUp = daysBehind * totalDailyRate;

    // Count skipped dates in the period for UI display
    const skippedDatesInPeriod = this.countSkippedDatesInRange(lastCoveredDate, today, skippedDates);

    return {
      loanId: dto.loanId,
      dailyRate: totalDailyRate,
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
   * Uses 30-day months for date calculations.
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
    // Calculate how many effective days this payment covers (keep fractional for accurate tracking)
    const daysCovered = paymentAmount / dailyRate;

    // Coverage starts the day after the last covered date
    let coverageStartDate = addDays(lastCoveredDate, 1);
    
    // Skip over any skipped dates at the start
    while (this.isDateSkipped(coverageStartDate, skippedDates)) {
      coverageStartDate = addDays(coverageStartDate, 1);
    }

    // Calculate coverage end date using logical days (30-day months)
    // For fractional days, we still want to show the partial day as covered
    // Even 0.5 days means the payment covers until that date
    const wholeDays = Math.floor(daysCovered);
    let coverageEndDate: Date;
    
    if (wholeDays > 0) {
      // If at least 1 full day, calculate normally
      // If paying for N days starting from coverageStartDate, it covers N days total
      // So we add (N-1) days to coverageStartDate to get the last day covered
      // Example: coverageStartDate = July 3, pay for 161 days → July 3 + 160 days = December 11
      // But we want July 3 to be day 1, so covering 161 days means through December 11
      coverageEndDate = this.addLogicalDays(coverageStartDate, wholeDays - 1);
    } else if (daysCovered > 0) {
      // For fractional days less than 1, the coverage end date is the start date itself
      // This means the payment partially covers that first day
      coverageEndDate = coverageStartDate;
    } else {
      // No coverage (shouldn't happen with valid payment amounts)
      coverageEndDate = coverageStartDate;
    }
    
    // Count skipped dates in this range and extend coverage accordingly
    const skippedInRange = this.countSkippedDatesInRange(coverageStartDate, coverageEndDate, skippedDates);
    if (skippedInRange > 0) {
      // Extend coverage by the number of skipped dates
      coverageEndDate = this.addLogicalDays(coverageEndDate, skippedInRange);
    }

    // Payment is late if the coverage start date is before or equal to today
    // Because if today = Dec 15 and loan is only covered until Dec 14,
    // the payment should start covering Dec 15 (today), which means it's late
    const today = startOfDay(paymentDate);
    const isLate = coverageStartDate <= today;

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

    // Get the daily payment rates
    const baseDailyRate = loan.installmentPaymentAmmount;
    const gpsDailyRate = loan.gpsInstallmentPayment || 0;
    const totalDailyRate = baseDailyRate + gpsDailyRate;
    
    // Calculate total payment amount (base + gps)
    const gpsAmount = dto.gps || 0;
    const totalPaymentAmount = dto.amount + gpsAmount;
    
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
    
    // Calculate payment coverage based on TOTAL amount (base + gps), considering skipped dates
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const coverage = this.calculatePaymentCoverageWithSkippedDates(
      totalPaymentAmount,
      totalDailyRate,
      lastCoveredDate,
      paymentDate,
      skippedDates,
    );

    // Determine if late/advance: use automatic calculation if not explicitly provided
    const isLate = dto.isLate !== undefined ? dto.isLate : coverage.isLate;
    const latePaymentDate = dto.latePaymentDate 
      ? toColombiaUtc(dto.latePaymentDate) 
      : (coverage.latePaymentDate ? toColombiaUtc(coverage.latePaymentDate) : null);

    // For advance payments, check if coverage end date is after or equal to today
    // This ensures that even fractional payments (0.5 days) show as advance when user is up to date
    const today = startOfDay(new Date());
    const isAdvance = dto.isAdvance !== undefined 
      ? dto.isAdvance 
      : (coverage.coverageEndDate >= today);
    // Always store the coverage end date as advancePaymentDate (represents last day covered by this payment)
    // This is needed for display even when the payment doesn't put the client ahead
    const advancePaymentDate = dto.advancePaymentDate 
      ? toColombiaUtc(dto.advancePaymentDate) 
      : toColombiaUtc(coverage.coverageEndDate);

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

    // Calculate fractional installments based on TOTAL payment amount (base + gps)
    // If customer pays 34,000 total and daily rate is 34,000, this counts as 1 installment
    const fractionalInstallmentsPaid = totalPaymentAmount / totalDailyRate;
    
    const updatedPaid = loan.paidInstallments + fractionalInstallmentsPaid;
    const updatedRemaining = Math.max(0, loan.installments - updatedPaid);
    // Only add base amount to totalPaid and subtract from debt (GPS is separate)
    const updatedTotalPaid = loan.totalPaid + dto.amount;
    const updatedDebt = Math.max(0, loan.debtRemaining - dto.amount);

    const newStatus =
      updatedDebt <= 0 || updatedRemaining <= 0
        ? LoanStatus.COMPLETED
        : LoanStatus.ACTIVE;

    // Calculate new lastCoveredDate after this payment
    const newLastCoveredDate = await this.getLastCoveredDate(dto.loanId, loan);

    await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        paidInstallments: updatedPaid,
        remainingInstallments: updatedRemaining,
        totalPaid: updatedTotalPaid,
        debtRemaining: updatedDebt,
        status: newStatus,
        lastCoveredDate: newLastCoveredDate,
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
              },
              payments: true, // Include all payments to calculate current status
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

    // Find the most recent installment per loan (to show current status only on latest)
    const mostRecentInstallmentPerLoan = new Map<string, string>();
    for (const installment of data) {
      if (!mostRecentInstallmentPerLoan.has(installment.loanId)) {
        // First occurrence is the most recent due to ordering by createdAt desc
        mostRecentInstallmentPerLoan.set(installment.loanId, installment.id);
      }
    }

    // Calculate current days behind/ahead for each unique loan
    const loanStatusCache = new Map<string, { currentDaysBehind: number; lastCoveredDate: Date }>();
    const today = startOfDay(new Date());

    for (const installment of data) {
      const loanId = installment.loanId;
      // Only calculate status for most recent installments
      if (mostRecentInstallmentPerLoan.get(loanId) === installment.id && !loanStatusCache.has(loanId)) {
        const loan = installment.loan;
        
        // Get all existing payments for this loan
        const existingPayments = await this.prisma.installment.findMany({
          where: { 
            loanId,
            loan: { archived: false },
          },
          orderBy: { createdAt: 'asc' },
        });
        
        // Fetch skipped dates for accurate calculation
        let skippedDates: Date[] = [];
        try {
          const skippedDatesData = await this.newsService.getSkippedDatesForLoan(loanId);
          skippedDates = skippedDatesData.dates.map(d => startOfDay(new Date(d)));
        } catch (error) {
          // Continue without skipped dates
        }

        // Calculate total days covered (with fractional support)
        const baseDailyRate = loan.installmentPaymentAmmount || 0;
        const gpsDailyRate = loan.gpsInstallmentPayment || 0;
        const totalDailyRate = baseDailyRate + gpsDailyRate;
        const downPayment = loan.downPayment || 0;
        
        let totalDaysCovered = totalDailyRate > 0 && downPayment > 0 ? downPayment / totalDailyRate : 0;
        for (const payment of existingPayments) {
          const totalPayment = (payment.amount || 0) + (payment.gps || 0);
          totalDaysCovered += totalPayment / totalDailyRate;
        }
        
        // Calculate days owed from start to today (excluding skipped dates)
        // Use actual calendar days, not logical 30-day months
        const loanStartDate = startOfDay(toColombiaUtc(new Date(loan.startDate)));
        
        // Count actual calendar days from loan start to today
        let daysOwed = 0;
        let currentDate = new Date(loanStartDate);
        while (currentDate < today) {
          currentDate = addDays(currentDate, 1);
          // Only count non-skipped dates
          if (!this.isDateSkipped(currentDate, skippedDates)) {
            daysOwed++;
          }
        }
        
        // currentDaysBehind = days owed - days covered
        // Positive = behind, Negative = ahead, Zero = up to date
        const currentDaysBehind = daysOwed - totalDaysCovered;
        
        console.log('💰 Loan status calculation:', {
          loanId,
          daysOwed,
          totalDaysCovered,
          currentDaysBehind,
          loanStartDate: loanStartDate.toISOString(),
          today: today.toISOString(),
        });
        
        const lastCoveredDate = await this.getLastCoveredDate(loanId, loan);
        loanStatusCache.set(loanId, { currentDaysBehind, lastCoveredDate });
      }
    }

    // Enrich only the most recent installment per loan with current status
    const enrichedData = data.map(installment => {
      const isMostRecent = mostRecentInstallmentPerLoan.get(installment.loanId) === installment.id;
      const loanStatus = isMostRecent ? loanStatusCache.get(installment.loanId) : null;
      
      return {
        ...installment,
        loan: {
          ...installment.loan,
          payments: undefined, // Remove payments array from response to reduce payload
        },
        // Only add currentDaysBehind to the most recent installment
        ...(isMostRecent && loanStatus ? {
          currentDaysBehind: loanStatus.currentDaysBehind,
          lastCoveredDate: loanStatus.lastCoveredDate,
          isLatestInstallment: true,
        } : {}),
      };
    });

    return {
      data: enrichedData,
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

    // Recalculate lastCoveredDate after removing this installment
    const newLastCoveredDate = await this.getLastCoveredDate(loan.id, loan, id);

    await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        paidInstallments: updatedPaid,
        remainingInstallments: updatedRemaining,
        totalPaid: updatedTotalPaid,
        debtRemaining: updatedDebt,
        status: newStatus,
        lastCoveredDate: newLastCoveredDate,
      },
    });

    return installment;
  }
}

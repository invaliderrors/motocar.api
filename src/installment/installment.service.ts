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
   * Every month is treated as having exactly 30 days.
   * 
   * Example: July 3 + 160 days
   * - Days left in July: 30 - 3 = 27 days (reaches July 30)
   * - Remaining: 160 - 27 = 133 days
   * - Full months: 133 ÷ 30 = 4 months (Aug, Sep, Oct, Nov)
   * - Final days: 133 % 30 = 13 days
   * - Result: December 13
   */
  private addLogicalDays(startDate: Date, daysToAdd: number): Date {
    if (daysToAdd === 0) return new Date(startDate);
    
    const result = new Date(startDate);
    let remainingDays = daysToAdd;
    const currentDay = result.getDate();
    
    // Days remaining in current month (assuming 30-day months)
    const daysLeftInCurrentMonth = DAYS_PER_MONTH - currentDay;
    
    if (remainingDays <= daysLeftInCurrentMonth) {
      // All days fit in current month
      result.setDate(currentDay + remainingDays);
    } else {
      // Move to next month
      remainingDays -= daysLeftInCurrentMonth;
      result.setMonth(result.getMonth() + 1);
      
      // Calculate how many full months and remaining days
      const fullMonths = Math.floor(remainingDays / DAYS_PER_MONTH);
      const finalDays = remainingDays % DAYS_PER_MONTH;
      
      // Add full months
      result.setMonth(result.getMonth() + fullMonths);
      
      // Add remaining days (if 0, means last day of previous month, so use day 30)
      result.setDate(finalDays === 0 ? DAYS_PER_MONTH : finalDays);
    }
    
    return result;
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
   * @returns Object with lastCoveredDate and totalDaysCovered (exact decimal)
   */
  private async getLastCoveredDate(loanId: string, loan: any, excludeInstallmentId?: string): Promise<{ lastCoveredDate: Date; totalDaysCovered: number }> {
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
      // No coverage at all - return the loan start date itself
      // The start date is covered by default, next payment starts from day after
      return {
        lastCoveredDate: loanStartDate,
        totalDaysCovered: 0,
      };
    }

    // Now we need to find the date that corresponds to totalWorkingDaysCovered
    // working days from the loan start date, using LOGICAL DAYS (30-day months)
    // and accounting for skipped dates
    //
    // IMPORTANT: The loan start date is ALREADY COVERED (day 0, free).
    // When you pay N installments:
    // - Start date: July 2 (day 0, free, doesn't count)
    // - First paid day: July 3 (day 1)
    // - 161 installments paid: July 3 is day 1, last day is day 161
    // - Formula: firstPaidDay + (daysPaid - 1) = last covered day
    // - Example: July 3 + (161 - 1) = July 3 + 160 = December 13
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

    // The start date is free, so first paid day is the next day
    const firstPaidDay = addDays(loanStartDate, 1);
    
    // If N days are paid, the last covered day is: firstPaidDay + (N - 1)
    // The first paid day (July 3) is day 1, so day 161 is July 3 + 160
    // Example: 161 days → July 3 + 160 = December 13
    let lastCoveredDate = this.addLogicalDays(firstPaidDay, fullDaysToCount - 1);
    
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

    return {
      lastCoveredDate,
      totalDaysCovered: totalWorkingDaysCovered, // Return exact fractional value
    };
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
    const systemDate = new Date();
    const colombiaDate = toColombiaUtc(systemDate);
    const today = startOfDay(colombiaDate);
    console.log('🕐 Date check in calculatePaymentCoverage:', {
      systemDate: systemDate.toISOString(),
      colombiaDate: colombiaDate.toISOString(),
      today: today.toISOString(),
      coverageStartDate: coverageStartDate.toISOString(),
    });
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
    const lastCoveredResult = await this.getLastCoveredDate(dto.loanId, loan, dto.excludeInstallmentId);
    const lastCoveredDate = lastCoveredResult.lastCoveredDate;
    const exactDaysCovered = lastCoveredResult.totalDaysCovered;
    
    // Use Colombia time for "today" calculation
    const systemDate = new Date();
    const colombiaDate = toColombiaUtc(systemDate);
    const today = startOfDay(colombiaDate);
    console.log('🕐 Date check in calculatePaymentCoverageDto:', {
      systemDate: systemDate.toISOString(),
      colombiaDate: colombiaDate.toISOString(),
      today: today.toISOString(),
    });

    // Calculate coverage considering skipped dates
    // dto.amount is the TOTAL payment amount (base + gps)
    const coverage = this.calculatePaymentCoverageWithSkippedDates(
      dto.amount,
      totalDailyRate,
      lastCoveredDate,
      today,
      skippedDates,
    );

    // Calculate EXACT fractional days behind/ahead
    // First calculate how many logical days from loan start to today (using 30-day months)
    const loanStartDate = startOfDay(toColombiaUtc(new Date(loan.startDate)));
    const logicalDaysFromStartToToday = this.getLogicalDaysDifference(loanStartDate, today);
    
    // Subtract skipped dates that fall in this range
    const skippedFromStartToToday = this.countSkippedDatesInRange(loanStartDate, today, skippedDates);
    const effectiveDaysFromStartToToday = logicalDaysFromStartToToday - skippedFromStartToToday;
    
    // Days behind = effective days owed - exact days covered
    // This preserves fractional precision (e.g., if they've paid 1.13 installments, exactDaysCovered = 1.13)
    const daysBehindExact = effectiveDaysFromStartToToday - exactDaysCovered;
    const daysBehind = Math.max(0, daysBehindExact);
    
    // For legacy compatibility, also calculate from lastCoveredDate to today
    const effectiveDaysFromLastCoveredToToday = this.calculateEffectiveDays(lastCoveredDate, today, skippedDates);
    
    // Calculate exact installments: total installments that should be paid by today
    const installmentsShouldBePaidByToday = effectiveDaysFromStartToToday;
    // Exact installments already paid (with full decimal precision)
    const exactInstallmentsPaid = exactDaysCovered;
    // Exact installments owed (can be fractional, e.g., 1.13)
    const exactInstallmentsOwed = Math.max(0, installmentsShouldBePaidByToday - exactInstallmentsPaid);
    
    console.log('📊 Payment coverage calculation:', {
      loanId: dto.loanId,
      loanStartDate: loan.startDate,
      lastCoveredDate: lastCoveredDate.toISOString(),
      lastCoveredDateFormatted: `${lastCoveredDate.getFullYear()}-${String(lastCoveredDate.getMonth() + 1).padStart(2, '0')}-${String(lastCoveredDate.getDate()).padStart(2, '0')}`,
      today: today.toISOString(),
      todayFormatted: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
      exactDaysCovered,
      effectiveDaysFromLastCoveredToToday,
      daysBehindExact,
      daysBehind,
      exactInstallmentsPaid,
      exactInstallmentsOwed,
      paymentDaysCovered: coverage.daysCovered,
      coverageStartDate: coverage.coverageStartDate.toISOString(),
      coverageEndDate: coverage.coverageEndDate.toISOString(),
      willBeAheadAfterPayment: coverage.daysCovered - daysBehind,
      skippedDatesCount: skippedDates.length,
    });
    
    // Calculate amount needed to catch up to today (only for non-skipped days)
    // Use exact fractional days for precise amount
    const amountNeededToCatchUp = daysBehind * totalDailyRate;

    // Count skipped dates in the period for UI display
    const skippedDatesInPeriod = this.countSkippedDatesInRange(lastCoveredDate, today, skippedDates);

    // Calculate current days ahead (before this payment)
    // If daysBehind is negative, they are currently ahead
    const currentDaysAhead = daysBehindExact < 0 ? Math.abs(daysBehindExact) : 0;

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
      currentDaysAhead, // Current days ahead BEFORE this payment
      // EXACT DECIMAL PRECISION FIELDS (e.g., 1.129032258 installments)
      exactInstallmentsPaid, // Exact installments paid so far (e.g., 1.13)
      exactInstallmentsOwed, // Exact installments owed (e.g., 1.87)
      exactDaysBehind: daysBehindExact, // Can be negative if ahead
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
    const lastCoveredResult = await this.getLastCoveredDate(dto.loanId, loan);
    const lastCoveredDate = lastCoveredResult.lastCoveredDate;
    
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
    // Parse paymentDate at midnight Colombia time if provided, otherwise use current time
    const paymentDate = dto.paymentDate 
      ? toColombiaMidnightUtc(dto.paymentDate) 
      : new Date();
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
      ? toColombiaMidnightUtc(dto.latePaymentDate) 
      : (coverage.latePaymentDate ? toColombiaMidnightUtc(coverage.latePaymentDate) : null);

    // For advance payments, check if coverage end date is after or equal to today
    // This ensures that even fractional payments (0.5 days) show as advance when user is up to date
    const systemDate = new Date();
    const colombiaDate = toColombiaUtc(systemDate);
    const today = startOfDay(colombiaDate);
    console.log('🕐 Date check in create method:', {
      systemDate: systemDate.toISOString(),
      colombiaDate: colombiaDate.toISOString(),
      today: today.toISOString(),
    });
    const isAdvance = dto.isAdvance !== undefined 
      ? dto.isAdvance 
      : (coverage.coverageEndDate >= today);
    // Always store the coverage end date as advancePaymentDate (represents last day covered by this payment)
    // This is needed for display even when the payment doesn't put the client ahead
    const advancePaymentDate = dto.advancePaymentDate 
      ? toColombiaMidnightUtc(dto.advancePaymentDate) 
      : toColombiaMidnightUtc(coverage.coverageEndDate);

    // Calculate debt snapshot BEFORE this payment for permanent storage
    // This makes each installment truly independent
    const baseDailyRateForSnapshot = loan.installmentPaymentAmmount;
    const gpsDailyRateForSnapshot = loan.gpsInstallmentPayment || 0;
    const totalDailyRateForSnapshot = baseDailyRateForSnapshot + gpsDailyRateForSnapshot;
    
    // Get total days covered before this payment
    const existingPayments = await this.prisma.installment.findMany({
      where: { 
        loanId: dto.loanId,
        loan: { archived: false },
      },
      orderBy: { createdAt: 'asc' },
    });
    
    const downPayment = loan.downPayment || 0;
    let totalDaysCoveredBeforePayment = totalDailyRateForSnapshot > 0 && downPayment > 0 
      ? downPayment / totalDailyRateForSnapshot 
      : 0;
    
    for (const payment of existingPayments) {
      const totalPayment = (payment.amount || 0) + (payment.gps || 0);
      totalDaysCoveredBeforePayment += totalPayment / totalDailyRateForSnapshot;
    }
    
    // Calculate days owed from start to today
    // IMPORTANT: We count days from start up to (but NOT including) today
    // because if someone pays on Dec 22, they haven't yet incurred the debt for Dec 22
    // They owe for all days BEFORE today, not including today
    const loanStartDate = startOfDay(toColombiaUtc(new Date(loan.startDate)));
    const yesterday = addDays(today, -1);
    const logicalDaysFromStartToYesterday = this.getLogicalDaysDifference(loanStartDate, yesterday);
    const skippedFromStartToYesterday = this.countSkippedDatesInRange(loanStartDate, yesterday, skippedDates);
    const daysOwedBeforePayment = logicalDaysFromStartToYesterday - skippedFromStartToYesterday;
    
    // Calculate exact debt BEFORE this payment
    const exactInstallmentsOwedBeforePayment = Math.max(0, daysOwedBeforePayment - totalDaysCoveredBeforePayment);
    const remainingAmountOwedBeforePayment = exactInstallmentsOwedBeforePayment * totalDailyRateForSnapshot;
    
    // Calculate payment status AFTER this payment is applied
    const daysCoveredByThisPayment = totalPaymentAmount / totalDailyRate;
    const totalDaysCoveredAfterPayment = totalDaysCoveredBeforePayment + daysCoveredByThisPayment;
    
    // Compare total coverage AFTER payment to days owed up to today
    const netPosition = totalDaysCoveredAfterPayment - daysOwedBeforePayment;
    
    // Split into separate behind/ahead values (one will be 0)
    const daysBehindAfterPayment = netPosition < 0 ? Math.abs(netPosition) : 0;
    const daysAheadAfterPayment = netPosition > 0 ? netPosition : 0;
    const isUpToDate = Math.abs(netPosition) < 0.01; // Within 0.01 days is considered "up to date"
    
    // Calculate remaining amount owed AFTER payment in currency
    const remainingAmountOwedAfterPayment = daysBehindAfterPayment * totalDailyRateForSnapshot;

    const installment = await this.prisma.installment.create({
      data: {
        store: { connect: { id: storeId } },
        loan: { connect: { id: dto.loanId } },
        amount: dto.amount,
        gps: dto.gps,
        paymentDate: paymentDate, // Already converted to midnight Colombia UTC above
        latePaymentDate: latePaymentDate,
        isAdvance: isAdvance,
        advancePaymentDate: advancePaymentDate,
        notes: dto.notes,
        paymentMethod: dto.paymentMethod,
        isLate: isLate,
        attachmentUrl: dto.attachmentUrl,
        // Store debt snapshot - IMMUTABLE after creation
        exactInstallmentsOwed: exactInstallmentsOwedBeforePayment,
        remainingAmountOwed: remainingAmountOwedBeforePayment,
        // Store payment status AFTER payment - For receipt generation
        daysBehind: daysBehindAfterPayment,
        daysAhead: daysAheadAfterPayment,
        isUpToDate: isUpToDate,
        daysCoveredByPayment: daysCoveredByThisPayment,
        remainingAmountOwedAfter: remainingAmountOwedAfterPayment,
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
    const newLastCoveredResult = await this.getLastCoveredDate(dto.loanId, loan);
    const newLastCoveredDate = newLastCoveredResult.lastCoveredDate;

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
    const today = startOfDay(toColombiaUtc(new Date()));

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
        // Use LOGICAL 30-day months for consistency with the rest of the system
        const loanStartDate = startOfDay(toColombiaUtc(new Date(loan.startDate)));
        
        // Calculate logical days from loan start to today (using 30-day months)
        const logicalDaysFromStartToToday = this.getLogicalDaysDifference(loanStartDate, today);
        
        // Subtract skipped dates that fall in this range
        const skippedFromStartToToday = this.countSkippedDatesInRange(loanStartDate, today, skippedDates);
        const daysOwed = logicalDaysFromStartToToday - skippedFromStartToToday;
        
        // currentDaysBehind = days owed - days covered (with exact decimal precision)
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
        
        const lastCoveredResult = await this.getLastCoveredDate(loanId, loan);
        loanStatusCache.set(loanId, { currentDaysBehind, lastCoveredDate: lastCoveredResult.lastCoveredDate });
      }
    }

    // Enrich only the most recent installment per loan with current status
    const enrichedData = data.map(installment => {
      const isMostRecent = mostRecentInstallmentPerLoan.get(installment.loanId) === installment.id;
      const loanStatus = isMostRecent ? loanStatusCache.get(installment.loanId) : null;
      
      // Log what we're doing for debugging
      console.log(`📝 Processing installment ${installment.id}:`, {
        isMostRecent,
        storedExactInstallmentsOwed: installment.exactInstallmentsOwed,
        storedRemainingAmountOwed: installment.remainingAmountOwed,
        loanId: installment.loanId,
      });
      
      // CRITICAL: Historical installments are COMPLETELY IMMUTABLE
      // We return them EXACTLY as stored in the database without any modification
      const result: any = {
        ...installment,
        loan: {
          ...installment.loan,
          payments: undefined, // Remove payments array from response to reduce payload
        },
      };
      
      // ONLY modify the latest installment with current status
      if (isMostRecent && loanStatus) {
        const loan = installment.loan;
        const baseDailyRate = loan.installmentPaymentAmmount || 0;
        const gpsDailyRate = loan.gpsInstallmentPayment || 0;
        const totalDailyRate = baseDailyRate + gpsDailyRate;
        
        // Calculate current debt for latest installment
        let currentExactInstallmentsOwed = 0;
        let currentRemainingAmountOwed = 0;
        
        if (loanStatus.currentDaysBehind > 0) {
          currentExactInstallmentsOwed = loanStatus.currentDaysBehind;
          currentRemainingAmountOwed = currentExactInstallmentsOwed * totalDailyRate;
        }
        
        console.log(`✏️ Updating latest installment ${installment.id} with current values:`, {
          currentExactInstallmentsOwed,
          currentRemainingAmountOwed,
        });
        
        // Set current values for latest installment only
        result.exactInstallmentsOwed = currentExactInstallmentsOwed;
        result.remainingAmountOwed = currentRemainingAmountOwed;
        result.currentDaysBehind = loanStatus.currentDaysBehind;
        result.lastCoveredDate = loanStatus.lastCoveredDate;
        result.isLatestInstallment = true;
      } else {
        // Historical installment - verify we're keeping stored values
        console.log(`🔒 Historical installment ${installment.id} keeping stored values:`, {
          exactInstallmentsOwed: result.exactInstallmentsOwed,
          remainingAmountOwed: result.remainingAmountOwed,
        });
      }
      
      return result;
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

    // Handle paymentDate - convert to midnight Colombia UTC if provided
    if (paymentDate !== undefined) {
      updateData.paymentDate = toColombiaMidnightUtc(paymentDate);
      console.log('📅 Converting paymentDate:', {
        original: paymentDate,
        converted: updateData.paymentDate
      });
    }

    // Handle latePaymentDate - convert to midnight Colombia UTC if provided, null if explicitly null
    if (latePaymentDate !== undefined) {
      updateData.latePaymentDate = latePaymentDate ? toColombiaMidnightUtc(latePaymentDate) : null;
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
    const newLastCoveredResult = await this.getLastCoveredDate(loan.id, loan, id);

    await this.prisma.loan.update({
      where: { id: loan.id },
      data: {
        paidInstallments: updatedPaid,
        remainingInstallments: updatedRemaining,
        totalPaid: updatedTotalPaid,
        debtRemaining: updatedDebt,
        status: newStatus,
        lastCoveredDate: newLastCoveredResult.lastCoveredDate,
      },
    });

    return installment;
  }
}

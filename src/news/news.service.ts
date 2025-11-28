import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto, UpdateNewsDto, QueryNewsDto, NewsType, NewsCategory } from './dto';
import { differenceInDays, addDays, format } from 'date-fns';

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate the number of days between start and end date (inclusive)
   * Working days: Monday to Sunday (all 7 days, no exclusions)
   */
  private calculateDaysBetweenDates(startDate: Date, endDate: Date): number {
    const days = differenceInDays(endDate, startDate) + 1; // +1 to include both start and end dates
    return Math.max(0, days); // Ensure non-negative
  }

  /**
   * Generate an array of dates between start and end date (inclusive)
   */
  private generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
      dates.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }
    
    return dates;
  }

  /**
   * Create a new news item
   * - For LOAN_SPECIFIC: requires loanId, stores skipped dates instead of modifying loan
   * - For STORE_WIDE: affects all loans in the store via skipped dates
   * - Auto-generates skipped dates from date range if autoCalculateInstallments is true
   */
  async create(dto: CreateNewsDto, createdById: string) {
    // Validate loan-specific news
    if (dto.type === NewsType.LOAN_SPECIFIC && !dto.loanId) {
      throw new BadRequestException('loanId is required for LOAN_SPECIFIC news');
    }

    // Validate store-wide news
    if (dto.type === NewsType.STORE_WIDE && dto.loanId) {
      throw new BadRequestException('loanId should not be provided for STORE_WIDE news');
    }

    // Verify loan exists and belongs to the store
    if (dto.loanId) {
      const loan = await this.prisma.loan.findUnique({
        where: { id: dto.loanId },
        select: { id: true, storeId: true },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.storeId !== dto.storeId) {
        throw new ForbiddenException('Loan does not belong to the specified store');
      }
    }

    // Calculate days unavailable from date range if not explicitly provided
    let daysUnavailable = dto.daysUnavailable;
    if (!daysUnavailable && dto.startDate && dto.endDate) {
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      daysUnavailable = this.calculateDaysBetweenDates(startDate, endDate);
    }

    // Build the skipped dates array
    // Priority: 1) Explicitly provided skippedDates, 2) Auto-generate from date range
    let skippedDates: Date[] = [];
    
    if (dto.skippedDates && dto.skippedDates.length > 0) {
      // Use explicitly provided skipped dates
      skippedDates = dto.skippedDates.map(d => new Date(d));
    } else if (dto.autoCalculateInstallments && dto.startDate && dto.endDate) {
      // Auto-generate dates from the date range
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      skippedDates = this.generateDateRange(startDate, endDate);
    } else if (dto.startDate && daysUnavailable && daysUnavailable > 0) {
      // Generate dates starting from startDate for daysUnavailable days
      const startDate = new Date(dto.startDate);
      const endDate = addDays(startDate, daysUnavailable - 1);
      skippedDates = this.generateDateRange(startDate, endDate);
    }

    // Calculate installments to subtract (for display purposes only, loan is NOT modified)
    let installmentsToSubtract = dto.installmentsToSubtract || skippedDates.length;

    // Create the news (NO loan modification - just track skipped dates)
    const news = await this.prisma.news.create({
      data: {
        type: dto.type,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        notes: dto.notes,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isActive: dto.isActive ?? true,
        autoCalculateInstallments: dto.autoCalculateInstallments ?? false,
        daysUnavailable: daysUnavailable || skippedDates.length,
        installmentsToSubtract,
        vehicleType: dto.vehicleType,
        // Recurring date configuration
        isRecurring: dto.isRecurring ?? false,
        recurringDay: dto.recurringDay,
        recurringMonths: dto.recurringMonths || [],
        skippedDates: skippedDates,
        store: {
          connect: { id: dto.storeId },
        },
        loan: dto.loanId ? {
          connect: { id: dto.loanId },
        } : undefined,
        createdBy: {
          connect: { id: createdById },
        },
      },
      include: {
        loan: {
          include: {
            user: true,
            vehicle: true,
          },
        },
        store: true,
        createdBy: true,
      },
    });

    return news;
  }

  /**
   * Calculate how many installments and amount should be subtracted based on days unavailable
   * Returns both the number of installments and the total amount to subtract from the loan
   * 
   * Working days: Monday to Sunday (all 7 days of the week)
   * The days unavailable directly translate to missed installments for daily frequency
   */
  private async calculateInstallmentsAndAmount(
    loanId: string,
    daysUnavailable: number,
  ): Promise<{ installments: number; amount: number }> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: { 
        paymentFrequency: true,
        installmentPaymentAmmount: true,
        gpsInstallmentPayment: true,
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Calculate installment cost per period
    const installmentCost = loan.installmentPaymentAmmount;
    const gpsCost = loan.gpsInstallmentPayment;

    // Calculate based on payment frequency
    // Working days are Monday-Sunday (all 7 days), no exclusions
    let installmentsToSubtract = 0;
    let amountToSubtract = 0;

    switch (loan.paymentFrequency) {
      case 'DAILY':
        // For daily payments: every day is a working day (Mon-Sun)
        // 1 day unavailable = 1 installment missed
        installmentsToSubtract = daysUnavailable;
        amountToSubtract = (installmentCost + gpsCost) * daysUnavailable;
        break;
      case 'WEEKLY':
        // For weekly payments: 7 days = 1 installment period
        installmentsToSubtract = Math.floor(daysUnavailable / 7);
        // If there's a remainder, calculate fractional installment
        const weeklyRemainder = daysUnavailable % 7;
        if (weeklyRemainder > 0) {
          installmentsToSubtract += weeklyRemainder / 7;
        }
        amountToSubtract = (installmentCost + gpsCost) * installmentsToSubtract;
        break;
      case 'BIWEEKLY':
        // For biweekly payments: 14 days = 1 installment period
        installmentsToSubtract = Math.floor(daysUnavailable / 14);
        // If there's a remainder, calculate fractional installment
        const biweeklyRemainder = daysUnavailable % 14;
        if (biweeklyRemainder > 0) {
          installmentsToSubtract += biweeklyRemainder / 14;
        }
        amountToSubtract = (installmentCost + gpsCost) * installmentsToSubtract;
        break;
      case 'MONTHLY':
        // For monthly payments: 30 days = 1 installment period
        installmentsToSubtract = Math.floor(daysUnavailable / 30);
        // If there's a remainder, calculate fractional installment
        const monthlyRemainder = daysUnavailable % 30;
        if (monthlyRemainder > 0) {
          installmentsToSubtract += monthlyRemainder / 30;
        }
        amountToSubtract = (installmentCost + gpsCost) * installmentsToSubtract;
        break;
      default:
        // Default to daily
        installmentsToSubtract = daysUnavailable;
        amountToSubtract = (installmentCost + gpsCost) * daysUnavailable;
    }

    return {
      installments: installmentsToSubtract,
      amount: amountToSubtract,
    };
  }

  /**
   * Find all news items with filters
   */
  async findAll(query: QueryNewsDto) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.loanId) {
      where.loanId = query.loanId;
    }

    if (query.storeId) {
      where.storeId = query.storeId;
    }

    if (query.vehicleType) {
      where.vehicleType = query.vehicleType;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [news, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        include: {
          loan: {
            include: {
              user: true,
              vehicle: true,
            },
          },
          store: true,
          createdBy: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.news.count({ where }),
    ]);

    return {
      data: news,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find a single news item by ID
   */
  async findOne(id: string) {
    const news = await this.prisma.news.findUnique({
      where: { id },
      include: {
        loan: {
          include: {
            user: true,
            vehicle: true,
          },
        },
        store: true,
        createdBy: true,
      },
    });

    if (!news) {
      throw new NotFoundException('News not found');
    }

    return news;
  }

  /**
   * Get active news for a specific loan
   */
  async getActiveLoanNews(loanId: string) {
    return this.prisma.news.findMany({
      where: {
        loanId,
        isActive: true,
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
      include: {
        createdBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get active store-wide news
   */
  async getActiveStoreNews(storeId: string) {
    return this.prisma.news.findMany({
      where: {
        storeId,
        type: NewsType.STORE_WIDE,
        isActive: true,
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
      include: {
        createdBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update a news item
   * Updates the skipped dates and other fields without modifying loans
   */
  async update(id: string, dto: UpdateNewsDto) {
    const existingNews = await this.prisma.news.findUnique({
      where: { id },
      include: { store: true },
    });

    if (!existingNews) {
      throw new NotFoundException('News not found');
    }

    // Calculate days unavailable from date range if not explicitly provided
    let daysUnavailable = dto.daysUnavailable;
    if (!daysUnavailable && dto.startDate && dto.endDate) {
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      daysUnavailable = this.calculateDaysBetweenDates(startDate, endDate);
    }

    // Build the skipped dates array if dates are being updated
    let skippedDates: Date[] | undefined = undefined;
    
    if (dto.skippedDates !== undefined) {
      // Use explicitly provided skipped dates
      skippedDates = dto.skippedDates.map(d => new Date(d));
    } else if (dto.autoCalculateInstallments && dto.startDate && dto.endDate) {
      // Auto-generate dates from the date range
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      skippedDates = this.generateDateRange(startDate, endDate);
    } else if (dto.startDate && daysUnavailable && daysUnavailable > 0) {
      // Generate dates starting from startDate for daysUnavailable days
      const startDate = new Date(dto.startDate);
      const endDate = addDays(startDate, daysUnavailable - 1);
      skippedDates = this.generateDateRange(startDate, endDate);
    }

    // Calculate installments to subtract (for display purposes only)
    let installmentsToSubtract = dto.installmentsToSubtract;
    if (skippedDates !== undefined && installmentsToSubtract === undefined) {
      installmentsToSubtract = skippedDates.length;
    }

    const updateData: any = { ...dto };
    
    if (dto.startDate) {
      updateData.startDate = new Date(dto.startDate);
    }
    if (dto.endDate) {
      updateData.endDate = new Date(dto.endDate);
    }
    if (daysUnavailable !== undefined) {
      updateData.daysUnavailable = daysUnavailable;
    }
    if (installmentsToSubtract !== undefined) {
      updateData.installmentsToSubtract = installmentsToSubtract;
    }
    if (skippedDates !== undefined) {
      updateData.skippedDates = skippedDates;
    }

    return this.prisma.news.update({
      where: { id },
      data: updateData,
      include: {
        loan: {
          include: {
            user: true,
            vehicle: true,
          },
        },
        store: true,
        createdBy: true,
      },
    });
  }

  /**
   * Delete a news item
   * Simply deletes the news - no loan modification needed
   */
  async remove(id: string) {
    const news = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!news) {
      throw new NotFoundException('News not found');
    }

    // Simply delete the news - skipped dates are stored in the news record
    // No loan modification needed
    return this.prisma.news.delete({
      where: { id },
    });
  }

  /**
   * Get total installments to subtract for a loan (sum of all active news)
   */
  async getTotalInstallmentsToSubtract(loanId: string): Promise<number> {
    const activeNews = await this.prisma.news.findMany({
      where: {
        loanId,
        isActive: true,
        installmentsToSubtract: { not: null },
      },
      select: {
        installmentsToSubtract: true,
      },
    });

    return activeNews.reduce((sum, news) => sum + (news.installmentsToSubtract || 0), 0);
  }

  /**
   * Get news summary for multiple loans in a single query
   * Returns a map of loanId -> { totalNewsCount, activeNewsCount, totalInstallmentsExcluded, skippedDatesCount }
   */
  async getNewsSummaryBatch(loanIds: string[]): Promise<Record<string, { totalNewsCount: number; activeNewsCount: number; totalInstallmentsExcluded: number; skippedDatesCount: number }>> {
    if (!loanIds || loanIds.length === 0) {
      return {};
    }

    // Get all news for the given loan IDs
    const allNews = await this.prisma.news.findMany({
      where: {
        loanId: { in: loanIds },
      },
      select: {
        loanId: true,
        isActive: true,
        endDate: true,
        installmentsToSubtract: true,
        skippedDates: true,
      },
    });

    // Group by loanId and calculate totals
    const result: Record<string, { totalNewsCount: number; activeNewsCount: number; totalInstallmentsExcluded: number; skippedDatesCount: number }> = {};

    // Initialize all loanIds with zero values
    for (const loanId of loanIds) {
      result[loanId] = { totalNewsCount: 0, activeNewsCount: 0, totalInstallmentsExcluded: 0, skippedDatesCount: 0 };
    }

    const now = new Date();

    // Aggregate the news data
    for (const news of allNews) {
      if (news.loanId) {
        result[news.loanId].totalNewsCount++;
        
        // Check if news is currently active (isActive AND endDate is null or in future)
        const isCurrentlyActive = news.isActive && (!news.endDate || new Date(news.endDate) >= now);
        if (isCurrentlyActive) {
          result[news.loanId].activeNewsCount++;
          result[news.loanId].totalInstallmentsExcluded += news.installmentsToSubtract || 0;
          result[news.loanId].skippedDatesCount += news.skippedDates?.length || 0;
        }
      }
    }

    return result;
  }

  /**
   * Get all news for a specific loan (both active and inactive)
   */
  async getAllLoanNews(loanId: string) {
    return this.prisma.news.findMany({
      where: {
        loanId,
      },
      include: {
        createdBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all skipped dates for a loan
   * Combines dates from:
   * 1. Loan-specific news (skippedDates array)
   * 2. Store-wide news affecting this loan (skippedDates + recurring dates)
   * Returns sorted unique dates
   */
  async getSkippedDatesForLoan(loanId: string): Promise<{ 
    dates: Date[]; 
    news: Array<{ id: string; title: string; category: string; dates: Date[]; isRecurring: boolean }> 
  }> {
    // Get the loan to find its store, vehicle type, and start date
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { 
        vehicle: true,
        store: true,
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Get loan-specific active news
    const loanNews = await this.prisma.news.findMany({
      where: {
        loanId,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        category: true,
        startDate: true,
        skippedDates: true,
        isRecurring: true,
        recurringDay: true,
        recurringMonths: true,
      },
    });

    // Get store-wide active news that apply to this loan
    const storeNews = await this.prisma.news.findMany({
      where: {
        storeId: loan.storeId,
        type: NewsType.STORE_WIDE,
        isActive: true,
        OR: [
          { vehicleType: null }, // Applies to all vehicle types
          { vehicleType: loan.vehicle.vehicleType }, // Matches this vehicle's type
        ],
      },
      select: {
        id: true,
        title: true,
        category: true,
        startDate: true,
        skippedDates: true,
        isRecurring: true,
        recurringDay: true,
        recurringMonths: true,
      },
    });

    // Combine all news
    const allNews = [...loanNews, ...storeNews];
    
    // Collect all dates
    const allDates: Date[] = [];
    const newsWithDates: Array<{ id: string; title: string; category: string; dates: Date[]; isRecurring: boolean }> = [];

    for (const news of allNews) {
      const newsDates: Date[] = [];
      
      // Add explicit skipped dates
      if (news.skippedDates && news.skippedDates.length > 0) {
        newsDates.push(...news.skippedDates);
      }

      // Generate recurring dates if applicable
      // For store-wide recurring news (like holidays), we want to apply from the LOAN's start date
      // This ensures late payment calculations are accurate for the entire loan period
      // For loan-specific news, we use the news start date
      if (news.isRecurring && news.recurringDay) {
        const newsStartDate = new Date(news.startDate);
        const loanStartDate = new Date(loan.startDate);
        const today = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 12);

        // For recurring store-wide news (holidays, days off), apply from loan start date
        // This allows retroactive application of recurring rules
        // The news startDate acts as "when was this rule created" not "when does it apply from"
        const effectiveStartDate = loanStartDate;

        let currentDate = new Date(effectiveStartDate.getFullYear(), effectiveStartDate.getMonth(), 1);
        
        while (currentDate <= endDate) {
          const month = currentDate.getMonth() + 1; // 1-12
          
          // Check if this month is included (empty array = all months)
          if (news.recurringMonths.length === 0 || news.recurringMonths.includes(month)) {
            // Create date for the recurring day in this month
            const recurringDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), news.recurringDay);
            
            // Only add if the date is valid (day exists in month) and >= loan start date
            if (recurringDate.getDate() === news.recurringDay && recurringDate >= effectiveStartDate) {
              newsDates.push(recurringDate);
            }
          }
          
          // Move to next month
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }

      if (newsDates.length > 0) {
        allDates.push(...newsDates);
        newsWithDates.push({
          id: news.id,
          title: news.title,
          category: news.category,
          dates: newsDates,
          isRecurring: news.isRecurring,
        });
      }
    }

    // Remove duplicates and sort
    const uniqueDates = [...new Set(allDates.map(d => d.getTime()))].map(t => new Date(t)).sort((a, b) => a.getTime() - b.getTime());

    return {
      dates: uniqueDates,
      news: newsWithDates,
    };
  }

  /**
   * Get skipped dates for multiple loans in a batch
   * Returns a map of loanId -> array of skipped dates
   */
  async getSkippedDatesBatch(loanIds: string[]): Promise<Record<string, Date[]>> {
    if (!loanIds || loanIds.length === 0) {
      return {};
    }

    // Get all loans with their vehicles and stores
    const loans = await this.prisma.loan.findMany({
      where: { id: { in: loanIds } },
      include: { 
        vehicle: true,
        store: true,
      },
    });

    // Initialize result with empty arrays
    const result: Record<string, Date[]> = {};
    for (const loanId of loanIds) {
      result[loanId] = [];
    }

    // Get all loan-specific active news
    const loanNews = await this.prisma.news.findMany({
      where: {
        loanId: { in: loanIds },
        isActive: true,
      },
      select: {
        loanId: true,
        startDate: true,
        skippedDates: true,
        isRecurring: true,
        recurringDay: true,
        recurringMonths: true,
      },
    });

    // Group loans by storeId to batch fetch store-wide news
    const storeIds = [...new Set(loans.map(l => l.storeId))];
    
    // Get all store-wide active news
    const storeNews = await this.prisma.news.findMany({
      where: {
        storeId: { in: storeIds },
        type: NewsType.STORE_WIDE,
        isActive: true,
      },
      select: {
        storeId: true,
        vehicleType: true,
        startDate: true,
        skippedDates: true,
        isRecurring: true,
        recurringDay: true,
        recurringMonths: true,
      },
    });

    const today = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 12);

    // Helper function to get dates from a news item, using loan start date for recurring
    const getDatesFromNews = (
      news: { startDate: Date; skippedDates: Date[]; isRecurring: boolean; recurringDay: number | null; recurringMonths: number[] },
      loanStartDate?: Date
    ): Date[] => {
      const dates: Date[] = [];

      // Add explicit skipped dates
      if (news.skippedDates && news.skippedDates.length > 0) {
        dates.push(...news.skippedDates);
      }

      // Generate recurring dates if applicable
      // For recurring news, apply from loan start date (if provided) to capture all historical skipped dates
      if (news.isRecurring && news.recurringDay) {
        const effectiveStartDate = new Date(loanStartDate || news.startDate);
        let currentDate = new Date(effectiveStartDate.getFullYear(), effectiveStartDate.getMonth(), 1);
        
        while (currentDate <= endDate) {
          const month = currentDate.getMonth() + 1;
          
          if (news.recurringMonths.length === 0 || news.recurringMonths.includes(month)) {
            const recurringDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), news.recurringDay);
            
            if (recurringDate.getDate() === news.recurringDay && recurringDate >= effectiveStartDate) {
              dates.push(recurringDate);
            }
          }
          
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }

      return dates;
    };

    // Process loan-specific news
    for (const news of loanNews) {
      if (news.loanId) {
        // For loan-specific news, we still use the news startDate
        const dates = getDatesFromNews(news, undefined);
        result[news.loanId].push(...dates);
      }
    }

    // Process store-wide news for each loan
    for (const loan of loans) {
      // Find applicable store news
      const applicableStoreNews = storeNews.filter(sn => 
        sn.storeId === loan.storeId && 
        (sn.vehicleType === null || sn.vehicleType === loan.vehicle.vehicleType)
      );

      for (const news of applicableStoreNews) {
        // For store-wide news, use loan.startDate to generate dates back to the loan start
        const dates = getDatesFromNews(news, loan.startDate);
        result[loan.id].push(...dates);
      }

      // Remove duplicates and sort for this loan
      result[loan.id] = [...new Set(result[loan.id].map(d => d.getTime()))]
        .map(t => new Date(t))
        .sort((a, b) => a.getTime() - b.getTime());
    }

    return result;
  }
}

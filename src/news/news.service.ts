import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto, UpdateNewsDto, QueryNewsDto, NewsType, NewsCategory } from './dto';
import { differenceInDays } from 'date-fns';

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
   * Create a new news item
   * - For LOAN_SPECIFIC: requires loanId
   * - For STORE_WIDE: affects all loans in the store
   * - Auto-calculates installments if autoCalculateInstallments is true
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

    // Auto-calculate installments if enabled
    let installmentsToSubtract = dto.installmentsToSubtract || 0;
    let affectedLoansCount = 0;
    
    if (dto.autoCalculateInstallments && daysUnavailable) {
      if (dto.type === NewsType.LOAN_SPECIFIC && dto.loanId) {
        // Handle single loan
        const result = await this.calculateInstallmentsAndAmount(
          dto.loanId,
          daysUnavailable,
        );
        installmentsToSubtract = result.installments;
        const amountToSubtract = result.amount;

        // Update the specific loan
        const loan = await this.prisma.loan.findUnique({
          where: { id: dto.loanId },
          select: { 
            totalAmount: true, 
            debtRemaining: true,
            remainingInstallments: true,
            installments: true,
          },
        });

        if (loan) {
          const newTotalAmount = loan.totalAmount - amountToSubtract;
          const newDebtRemaining = Math.max(0, loan.debtRemaining - amountToSubtract);
          // Round installmentsToSubtract to nearest integer for remaining installments
          const installmentsToSubtractInt = Math.round(installmentsToSubtract);
          const newRemainingInstallments = Math.max(0, loan.remainingInstallments - installmentsToSubtractInt);
          const newTotalInstallments = Math.max(0, loan.installments - installmentsToSubtractInt);
          
          await this.prisma.loan.update({
            where: { id: dto.loanId },
            data: { 
              totalAmount: newTotalAmount,
              debtRemaining: newDebtRemaining,
              remainingInstallments: newRemainingInstallments,
              installments: newTotalInstallments,
            },
          });
          affectedLoansCount = 1;
        }
      } else if (dto.type === NewsType.STORE_WIDE) {
        // Handle all active loans in the store, optionally filtered by vehicle type
        const whereClause: any = {
          storeId: dto.storeId,
          archived: false,
          status: { in: ['ACTIVE', 'PENDING'] },
        };

        // If vehicleType is specified, filter by it
        if (dto.vehicleType) {
          whereClause.vehicle = {
            vehicleType: dto.vehicleType,
          };
        }

        const loans = await this.prisma.loan.findMany({
          where: whereClause,
          select: {
            id: true,
            totalAmount: true,
            debtRemaining: true,
            remainingInstallments: true,
            installments: true,
            paymentFrequency: true,
            installmentPaymentAmmount: true,
            gpsInstallmentPayment: true,
          },
        });

        // Calculate and update each loan
        for (const loan of loans) {
          const result = await this.calculateInstallmentsAndAmount(
            loan.id,
            daysUnavailable,
          );
          
          const newTotalAmount = loan.totalAmount - result.amount;
          const newDebtRemaining = Math.max(0, loan.debtRemaining - result.amount);
          // Round installmentsToSubtract to nearest integer for remaining installments
          const installmentsToSubtractInt = Math.round(result.installments);
          const newRemainingInstallments = Math.max(0, loan.remainingInstallments - installmentsToSubtractInt);
          const newTotalInstallments = Math.max(0, loan.installments - installmentsToSubtractInt);
          
          await this.prisma.loan.update({
            where: { id: loan.id },
            data: {
              totalAmount: newTotalAmount,
              debtRemaining: newDebtRemaining,
              remainingInstallments: newRemainingInstallments,
              installments: newTotalInstallments,
            },
          });
        }
        
        affectedLoansCount = loans.length;
        // For store-wide news, use the calculated days unavailable
        installmentsToSubtract = daysUnavailable; // Simplified for store-wide
      }
    }

    // Create the news
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
        daysUnavailable: daysUnavailable || dto.daysUnavailable,
        installmentsToSubtract,
        vehicleType: dto.vehicleType,
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

    // Recalculate installments and amount if days unavailable changed
    let installmentsToSubtract = dto.installmentsToSubtract;
    
    if (dto.autoCalculateInstallments && daysUnavailable) {
      if (existingNews.type === NewsType.LOAN_SPECIFIC && existingNews.loanId) {
        // Handle single loan update
        const result = await this.calculateInstallmentsAndAmount(
          existingNews.loanId,
          daysUnavailable,
        );
        installmentsToSubtract = result.installments;
        const amountToSubtract = result.amount;

        // If this is an update and the days changed, we need to adjust the loan
        if (existingNews.daysUnavailable && existingNews.autoCalculateInstallments) {
          const oldResult = await this.calculateInstallmentsAndAmount(
            existingNews.loanId,
            existingNews.daysUnavailable,
          );
          
          const loan = await this.prisma.loan.findUnique({
            where: { id: existingNews.loanId },
            select: { 
              totalAmount: true, 
              debtRemaining: true,
              remainingInstallments: true,
              installments: true,
            },
          });

          if (loan) {
            // Net change (new - old)
            const netAmountChange = amountToSubtract - oldResult.amount;
            const netInstallmentsChange = installmentsToSubtract - oldResult.installments;
            // Round to nearest integer for installments
            const netInstallmentsChangeInt = Math.round(netInstallmentsChange);
            
            const newTotalAmount = loan.totalAmount - netAmountChange;
            const newDebtRemaining = Math.max(0, loan.debtRemaining - netAmountChange);
            const newRemainingInstallments = Math.max(0, loan.remainingInstallments - netInstallmentsChangeInt);
            const newTotalInstallments = Math.max(0, loan.installments - netInstallmentsChangeInt);
            
            await this.prisma.loan.update({
              where: { id: existingNews.loanId },
              data: { 
                totalAmount: newTotalAmount,
                debtRemaining: newDebtRemaining,
                remainingInstallments: newRemainingInstallments,
                installments: newTotalInstallments,
              },
            });
          }
        } else {
          // New auto-calculation, just subtract
          const loan = await this.prisma.loan.findUnique({
            where: { id: existingNews.loanId },
            select: { 
              totalAmount: true, 
              debtRemaining: true,
              remainingInstallments: true,
              installments: true,
            },
          });

          if (loan) {
            const newTotalAmount = loan.totalAmount - amountToSubtract;
            const newDebtRemaining = Math.max(0, loan.debtRemaining - amountToSubtract);
            // Round to nearest integer for installments
            const installmentsToSubtractInt = Math.round(installmentsToSubtract);
            const newRemainingInstallments = Math.max(0, loan.remainingInstallments - installmentsToSubtractInt);
            const newTotalInstallments = Math.max(0, loan.installments - installmentsToSubtractInt);
            
            await this.prisma.loan.update({
              where: { id: existingNews.loanId },
              data: { 
                totalAmount: newTotalAmount,
                debtRemaining: newDebtRemaining,
                remainingInstallments: newRemainingInstallments,
                installments: newTotalInstallments,
              },
            });
          }
        }
      } else if (existingNews.type === NewsType.STORE_WIDE) {
        // Handle all active loans in store, optionally filtered by vehicle type
        const whereClause: any = {
          storeId: existingNews.storeId,
          archived: false,
          status: { in: ['ACTIVE', 'PENDING'] },
        };

        // If vehicleType is specified, filter by it
        if (dto.vehicleType || existingNews.vehicleType) {
          const vehicleType = dto.vehicleType || existingNews.vehicleType;
          whereClause.vehicle = {
            vehicleType: vehicleType,
          };
        }

        const loans = await this.prisma.loan.findMany({
          where: whereClause,
          select: {
            id: true,
            totalAmount: true,
            debtRemaining: true,
            remainingInstallments: true,
            installments: true,
          },
        });

        for (const loan of loans) {
          const result = await this.calculateInstallmentsAndAmount(
            loan.id,
            daysUnavailable,
          );
          
          // Calculate net change if updating existing auto-calculated news
          let netAmountChange = result.amount;
          let netInstallmentsChange = result.installments;
          
          if (existingNews.daysUnavailable && existingNews.autoCalculateInstallments) {
            const oldResult = await this.calculateInstallmentsAndAmount(
              loan.id,
              existingNews.daysUnavailable,
            );
            netAmountChange = result.amount - oldResult.amount;
            netInstallmentsChange = result.installments - oldResult.installments;
          }
          
          const newTotalAmount = loan.totalAmount - netAmountChange;
          const newDebtRemaining = Math.max(0, loan.debtRemaining - netAmountChange);
          // Round to nearest integer for installments
          const netInstallmentsChangeInt = Math.round(netInstallmentsChange);
          const newRemainingInstallments = Math.max(0, loan.remainingInstallments - netInstallmentsChangeInt);
          const newTotalInstallments = Math.max(0, loan.installments - netInstallmentsChangeInt);
          
          await this.prisma.loan.update({
            where: { id: loan.id },
            data: {
              totalAmount: newTotalAmount,
              debtRemaining: newDebtRemaining,
              remainingInstallments: newRemainingInstallments,
              installments: newTotalInstallments,
            },
          });
        }
        
        installmentsToSubtract = daysUnavailable;
      }
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
   * If the news had auto-calculated amounts, restore them to the loan(s)
   */
  async remove(id: string) {
    const news = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!news) {
      throw new NotFoundException('News not found');
    }

    // If this news had auto-calculated amounts, restore them to the loan(s)
    if (news.autoCalculateInstallments && news.daysUnavailable) {
      // Handle LOAN_SPECIFIC news
      if (news.type === 'LOAN_SPECIFIC' && news.loanId) {
        const result = await this.calculateInstallmentsAndAmount(
          news.loanId,
          news.daysUnavailable,
        );

        const loan = await this.prisma.loan.findUnique({
          where: { id: news.loanId },
          select: { 
            totalAmount: true, 
            debtRemaining: true,
            remainingInstallments: true,
            installments: true,
          },
        });

        if (loan) {
          // Add back the amount that was subtracted
          const newTotalAmount = loan.totalAmount + result.amount;
          const newDebtRemaining = loan.debtRemaining + result.amount;
          // Round to nearest integer for installments
          const installmentsToRestoreInt = Math.round(result.installments);
          const newRemainingInstallments = loan.remainingInstallments + installmentsToRestoreInt;
          const newTotalInstallments = loan.installments + installmentsToRestoreInt;
          
          await this.prisma.loan.update({
            where: { id: news.loanId },
            data: { 
              totalAmount: newTotalAmount,
              debtRemaining: newDebtRemaining,
              remainingInstallments: newRemainingInstallments,
              installments: newTotalInstallments,
            },
          });
        }
      }
      // Handle STORE_WIDE news - restore for all affected loans
      else if (news.type === 'STORE_WIDE' && news.storeId) {
        const whereClause: any = {
          storeId: news.storeId,
          archived: false,
          status: {
            in: ['ACTIVE', 'PENDING'],
          },
        };

        // If vehicleType was specified, filter by it
        if (news.vehicleType) {
          whereClause.vehicle = {
            vehicleType: news.vehicleType,
          };
        }

        const loans = await this.prisma.loan.findMany({
          where: whereClause,
          select: {
            id: true,
            totalAmount: true,
            debtRemaining: true,
            remainingInstallments: true,
            installments: true,
          },
        });

        // Restore installments for each loan
        for (const loan of loans) {
          const result = await this.calculateInstallmentsAndAmount(
            loan.id,
            news.daysUnavailable,
          );

          const newTotalAmount = loan.totalAmount + result.amount;
          const newDebtRemaining = loan.debtRemaining + result.amount;
          // Round to nearest integer for installments
          const installmentsToRestoreInt = Math.round(result.installments);
          const newRemainingInstallments = loan.remainingInstallments + installmentsToRestoreInt;
          const newTotalInstallments = loan.installments + installmentsToRestoreInt;

          await this.prisma.loan.update({
            where: { id: loan.id },
            data: {
              totalAmount: newTotalAmount,
              debtRemaining: newDebtRemaining,
              remainingInstallments: newRemainingInstallments,
              installments: newTotalInstallments,
            },
          });
        }
      }
    }

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
}

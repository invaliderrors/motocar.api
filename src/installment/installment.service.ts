import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInstallmentDto, FindInstallmentFiltersDto, UpdateInstallmentDto } from './installment.dto';
import { toColombiaMidnightUtc, toColombiaEndOfDayUtc, toColombiaUtc } from 'src/lib/dates';
import { addDays } from 'date-fns';
import { BaseStoreService } from 'src/lib/base-store.service';
import { LoanStatus, Prisma } from 'src/prisma/generated/client';

@Injectable()
export class InstallmentService extends BaseStoreService {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
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

    const installment = await this.prisma.installment.create({
      data: {
        store: { connect: { id: storeId } },
        loan: { connect: { id: dto.loanId } },
        amount: dto.amount,
        gps: dto.gps,
        paymentDate: dto.paymentDate ? toColombiaUtc(dto.paymentDate) : toColombiaUtc(new Date()), // Actual payment date from form, or now if not provided
        latePaymentDate: dto.latePaymentDate ? toColombiaUtc(dto.latePaymentDate) : null, // Original due date (if late)
        isAdvance: dto.isAdvance ?? false,
        advancePaymentDate: dto.advancePaymentDate ? toColombiaUtc(dto.advancePaymentDate) : null, // Future due date (if advance)
        notes: dto.notes,
        paymentMethod: dto.paymentMethod,
        isLate: dto.isLate ?? false,
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

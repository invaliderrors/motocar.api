import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateExpenseDto, FindExpenseFiltersDto } from './dto';
import {
  toColombiaEndOfDayUtc,
  toColombiaMidnightUtc,
} from 'src/lib/dates';
import { addDays } from 'date-fns';
import { BaseStoreService } from 'src/lib/base-store.service';
import { Prisma } from 'src/prisma/generated/client';

@Injectable()
export class ExpenseService extends BaseStoreService {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async create(dto: CreateExpenseDto, storeId: string) {
    return await this.prisma.expense.create({
      data: {
        amount: dto.amount,
        date: toColombiaMidnightUtc(dto.date),
        category: dto.category,
        paymentMethod: dto.paymentMethod,
        beneficiary: dto.beneficiary,
        reference: dto.reference,
        description: dto.description,
        attachmentUrl: dto.attachmentUrl,
        store: { connect: { id: storeId } },
        cashRegister: dto.cashRegisterId
          ? { connect: { id: dto.cashRegisterId } }
          : undefined,
        createdBy: { connect: { id: dto.createdById } },
        provider: dto.providerId
          ? { connect: { id: dto.providerId } }
          : undefined,
      }
    });
  }

  async findAll(filters: FindExpenseFiltersDto, userStoreId: string | null): Promise<Expense[]> {
    const { startDate, endDate } = filters;
    const where: Prisma.ExpenseWhereInput = {
      ...this.storeFilter(userStoreId),
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = toColombiaMidnightUtc(startDate);
      }
      if (endDate) {
        const extendedEnd = addDays(new Date(endDate), 1);
        where.date.lte = toColombiaEndOfDayUtc(extendedEnd);
      }
    }

    return this.prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        cashRegister: true,
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
      },
    });
  }

  async findByCashRegisterId(cashRegisterId: string, userStoreId: string | null) {
    return this.prisma.expense.findMany({
      where: { 
        cashRegisterId,
        ...this.storeFilter(userStoreId),
      },
      orderBy: { date: 'desc' },
      include: {
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
      },
    });
  }

  async update(id: string, dto: CreateExpenseDto, userStoreId: string | null) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    // Validate store access
    this.validateStoreAccess(expense, userStoreId);

    if (expense.cashRegisterId) {
      throw new Error(
        'Cannot update an expense that is already associated with a cash register'
      );
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        amount: dto.amount,
        date: toColombiaMidnightUtc(dto.date),
        category: dto.category,
        paymentMethod: dto.paymentMethod,
        beneficiary: dto.beneficiary,
        reference: dto.reference,
        description: dto.description,
        attachmentUrl: dto.attachmentUrl,
        cashRegister: dto.cashRegisterId
          ? { connect: { id: dto.cashRegisterId } }
          : undefined,
        createdBy: { connect: { id: dto.createdById } },
        provider: dto.providerId
          ? { connect: { id: dto.providerId } }
          : undefined,
      }
    });
  }

  async delete(id: string, userStoreId: string | null) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    // Validate store access
    this.validateStoreAccess(expense, userStoreId);

    if (expense.cashRegisterId) {
      throw new ForbiddenException(
        'No se puede eliminar un gasto que ya está asociado a un cierre de caja.'
      );
    }

    return this.prisma.expense.delete({ where: { id } });
  }
}

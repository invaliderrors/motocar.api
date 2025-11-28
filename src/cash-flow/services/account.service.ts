import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto, AccountQueryDto } from '../dto/account.dto';

@Injectable()
export class CashFlowAccountService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAccountDto, userId?: string) {
    return this.prisma.cashFlowAccount.create({
      data: {
        ...dto,
        metadata: dto.metadata as any,
      },
    });
  }

  async findAll(query: AccountQueryDto) {
    const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc', ...filters } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.accountType) where.accountType = filters.accountType;
    if (filters.currency) where.currency = filters.currency;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const [accounts, total] = await Promise.all([
      this.prisma.cashFlowAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              transactions: true,
              transfersFrom: true,
              transfersTo: true,
            },
          },
        },
      }),
      this.prisma.cashFlowAccount.count({ where }),
    ]);

    return {
      data: accounts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const account = await this.prisma.cashFlowAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactions: true,
            transfersFrom: true,
            transfersTo: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async update(id: string, dto: UpdateAccountDto) {
    await this.findOne(id); // Check existence

    return this.prisma.cashFlowAccount.update({
      where: { id },
      data: {
        ...dto,
        metadata: dto.metadata as any,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Check if account has transactions
    const transactionCount = await this.prisma.cashFlowTransaction.count({
      where: { accountId: id },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        `Cannot delete account with ${transactionCount} transactions. Archive it instead.`,
      );
    }

    return this.prisma.cashFlowAccount.delete({ where: { id } });
  }

  async getBalance(id: string, asOfDate?: Date) {
    await this.findOne(id);

    const where: any = { accountId: id };
    if (asOfDate) {
      where.date = { lte: asOfDate };
    }

    const transactions = await this.prisma.cashFlowTransaction.findMany({
      where,
      select: {
        type: true,
        amount: true,
      },
    });

    const balance = transactions.reduce((sum, tx) => {
      return tx.type === 'INFLOW' ? sum + tx.amount : sum - tx.amount;
    }, 0);

    return { accountId: id, balance, asOfDate: asOfDate || new Date() };
  }
}

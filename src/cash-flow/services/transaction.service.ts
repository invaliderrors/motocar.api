import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateTransactionDto,
  CreateBatchTransactionsDto,
  UpdateTransactionDto,
  TransactionQueryDto,
} from '../dto/transaction.dto';

@Injectable()
export class CashFlowTransactionService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTransactionDto, userId?: string) {
    // Check idempotency
    const existing = await this.prisma.cashFlowTransaction.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });

    if (existing) {
      return existing; // Return existing transaction (idempotent)
    }

    // Verify account exists
    const account = await this.prisma.cashFlowAccount.findUnique({
      where: { id: dto.accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    }

    // Create transaction
    const transaction = await this.prisma.cashFlowTransaction.create({
      data: {
        ...dto,
        date: new Date(dto.date),
        metadata: dto.metadata as any,
        createdById: userId,
      },
      include: {
        account: true,
      },
    });

    // Update account balance
    await this.updateAccountBalance(dto.accountId);

    return transaction;
  }

  async createBatch(dto: CreateBatchTransactionsDto, userId?: string) {
    const results: Array<{
      success: boolean;
      transaction?: any;
      idempotencyKey?: string;
      error?: string;
    }> = [];
    const errors: any[] = [];

    for (const txDto of dto.transactions) {
      try {
        const tx = await this.create(txDto, userId);
        results.push({ success: true, transaction: tx });
      } catch (error) {
        results.push({
          success: false,
          idempotencyKey: txDto.idempotencyKey,
          error: error.message,
        });
        errors.push(error);
      }
    }

    return {
      results,
      summary: {
        total: dto.transactions.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    };
  }

  async findAll(query: TransactionQueryDto) {
    const { page = 1, limit = 50, sortBy = 'date', sortOrder = 'desc', ...filters } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.category) where.category = filters.category;
    if (filters.currency) where.currency = filters.currency;
    if (filters.counterparty) where.counterparty = { contains: filters.counterparty, mode: 'insensitive' };
    if (filters.isReconciled !== undefined) where.isReconciled = filters.isReconciled;

    // Amount range
    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      where.amount = {};
      if (filters.amountMin !== undefined) where.amount.gte = filters.amountMin;
      if (filters.amountMax !== undefined) where.amount.lte = filters.amountMax;
    }

    // Date range
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    // Free text search
    if (filters.search) {
      where.OR = [
        { memo: { contains: filters.search, mode: 'insensitive' } },
        { counterparty: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      this.prisma.cashFlowTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
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
      }),
      this.prisma.cashFlowTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({
      where: { id },
      include: {
        account: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async update(id: string, dto: UpdateTransactionDto) {
    await this.findOne(id);

    return this.prisma.cashFlowTransaction.update({
      where: { id },
      data: {
        ...dto,
        metadata: dto.metadata as any,
      },
      include: {
        account: true,
      },
    });
  }

  async remove(id: string) {
    const transaction = await this.findOne(id);

    // Check if this is part of a transfer
    if (transaction.transferId) {
      throw new BadRequestException(
        'Cannot delete transaction that is part of a transfer. Delete the transfer instead.',
      );
    }

    const deleted = await this.prisma.cashFlowTransaction.delete({ where: { id } });

    // Update account balance
    await this.updateAccountBalance(transaction.accountId);

    return deleted;
  }

  private async updateAccountBalance(accountId: string) {
    const transactions = await this.prisma.cashFlowTransaction.findMany({
      where: { accountId },
      select: {
        type: true,
        amount: true,
      },
    });

    const balance = transactions.reduce((sum, tx) => {
      return tx.type === 'INFLOW' ? sum + tx.amount : sum - tx.amount;
    }, 0);

    await this.prisma.cashFlowAccount.update({
      where: { id: accountId },
      data: { balance },
    });

    return balance;
  }
}

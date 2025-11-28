import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransferDto } from '../dto/transfer.dto';

@Injectable()
export class CashFlowTransferService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTransferDto, userId?: string) {
    // Check idempotency
    const existing = await this.prisma.cashFlowTransfer.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });

    if (existing) {
      return this.prisma.cashFlowTransfer.findUnique({
        where: { id: existing.id },
        include: {
          fromAccount: true,
          toAccount: true,
        },
      });
    }

    // Validate accounts
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Cannot transfer to the same account');
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.prisma.cashFlowAccount.findUnique({ where: { id: dto.fromAccountId } }),
      this.prisma.cashFlowAccount.findUnique({ where: { id: dto.toAccountId } }),
    ]);

    if (!fromAccount) {
      throw new NotFoundException(`From account ${dto.fromAccountId} not found`);
    }

    if (!toAccount) {
      throw new NotFoundException(`To account ${dto.toAccountId} not found`);
    }

    // Create transfer with two transactions in a transaction (database transaction)
    return await this.prisma.$transaction(async (tx) => {
      // Create debit transaction (OUTFLOW from source account)
      const debitTx = await tx.cashFlowTransaction.create({
        data: {
          idempotencyKey: `${dto.idempotencyKey}-debit`,
          accountId: dto.fromAccountId,
          type: 'OUTFLOW',
          category: 'TRANSFER',
          amount: dto.amount,
          currency: dto.currency,
          date: new Date(dto.date),
          counterparty: toAccount.name,
          memo: dto.memo || `Transfer to ${toAccount.name}`,
          metadata: dto.metadata as any,
          createdById: userId,
        },
      });

      // Create credit transaction (INFLOW to destination account)
      const creditTx = await tx.cashFlowTransaction.create({
        data: {
          idempotencyKey: `${dto.idempotencyKey}-credit`,
          accountId: dto.toAccountId,
          type: 'INFLOW',
          category: 'TRANSFER',
          amount: dto.amount,
          currency: dto.currency,
          date: new Date(dto.date),
          counterparty: fromAccount.name,
          memo: dto.memo || `Transfer from ${fromAccount.name}`,
          metadata: dto.metadata as any,
          createdById: userId,
        },
      });

      // Create transfer linking both transactions
      const transfer = await tx.cashFlowTransfer.create({
        data: {
          idempotencyKey: dto.idempotencyKey,
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          amount: dto.amount,
          currency: dto.currency,
          date: new Date(dto.date),
          memo: dto.memo,
          metadata: dto.metadata as any,
          debitTxId: debitTx.id,
          creditTxId: creditTx.id,
          createdById: userId,
        },
        include: {
          fromAccount: true,
          toAccount: true,
        },
      });

      // Update transaction records with transfer ID
      await Promise.all([
        tx.cashFlowTransaction.update({
          where: { id: debitTx.id },
          data: { transferId: transfer.id },
        }),
        tx.cashFlowTransaction.update({
          where: { id: creditTx.id },
          data: { transferId: transfer.id },
        }),
      ]);

      // Update account balances
      await this.updateAccountBalance(dto.fromAccountId, tx);
      await this.updateAccountBalance(dto.toAccountId, tx);

      return transfer;
    });
  }

  async findAll(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [transfers, total] = await Promise.all([
      this.prisma.cashFlowTransfer.findMany({
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          fromAccount: {
            select: {
              id: true,
              name: true,
              accountType: true,
              currency: true,
            },
          },
          toAccount: {
            select: {
              id: true,
              name: true,
              accountType: true,
              currency: true,
            },
          },
        },
      }),
      this.prisma.cashFlowTransfer.count(),
    ]);

    return {
      data: transfers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const transfer = await this.prisma.cashFlowTransfer.findUnique({
      where: { id },
      include: {
        fromAccount: true,
        toAccount: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfer with ID ${id} not found`);
    }

    return transfer;
  }

  async remove(id: string) {
    const transfer = await this.findOne(id);

    // Delete transfer and associated transactions in a transaction
    return await this.prisma.$transaction(async (tx) => {
      // Delete the transactions
      await Promise.all([
        tx.cashFlowTransaction.delete({ where: { id: transfer.debitTxId } }),
        tx.cashFlowTransaction.delete({ where: { id: transfer.creditTxId } }),
      ]);

      // Delete the transfer
      const deleted = await tx.cashFlowTransfer.delete({ where: { id } });

      // Update account balances
      await this.updateAccountBalance(transfer.fromAccountId, tx);
      await this.updateAccountBalance(transfer.toAccountId, tx);

      return deleted;
    });
  }

  private async updateAccountBalance(accountId: string, tx: any) {
    const transactions = await tx.cashFlowTransaction.findMany({
      where: { accountId },
      select: {
        type: true,
        amount: true,
      },
    });

    const balance = transactions.reduce((sum: number, transaction: any) => {
      return transaction.type === 'INFLOW' ? sum + transaction.amount : sum - transaction.amount;
    }, 0);

    await tx.cashFlowAccount.update({
      where: { id: accountId },
      data: { balance },
    });

    return balance;
  }
}

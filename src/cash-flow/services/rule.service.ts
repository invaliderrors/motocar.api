import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRuleDto, UpdateRuleDto, DryRunRuleDto } from '../dto/rule.dto';

@Injectable()
export class CashFlowRuleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRuleDto, userId?: string) {
    return this.prisma.cashFlowRule.create({
      data: {
        ...dto,
        metadata: dto.metadata as any,
      },
    });
  }

  async findAll() {
    return this.prisma.cashFlowRule.findMany({
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.cashFlowRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(`Rule with ID ${id} not found`);
    }

    return rule;
  }

  async update(id: string, dto: UpdateRuleDto) {
    await this.findOne(id);

    return this.prisma.cashFlowRule.update({
      where: { id },
      data: {
        ...dto,
        metadata: dto.metadata as any,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cashFlowRule.delete({ where: { id } });
  }

  async dryRun(dto: DryRunRuleDto) {
    const rule = await this.findOne(dto.ruleId);

    const transactions = await this.prisma.cashFlowTransaction.findMany({
      where: {
        id: { in: dto.transactionIds },
      },
      include: {
        account: true,
      },
    });

    const results = transactions.map((tx) => {
      const matches = this.evaluateRule(rule, tx);
      let updates: any = {};

      if (matches) {
        if (rule.targetCategory) {
          updates.category = rule.targetCategory;
        }
        if (rule.targetCounterparty) {
          updates.counterparty = rule.targetCounterparty;
        }
        if (rule.addTags && rule.addTags.length > 0) {
          updates.tags = [...new Set([...tx.tags, ...rule.addTags])];
        }
      }

      return {
        transactionId: tx.id,
        matched: matches,
        currentData: {
          category: tx.category,
          counterparty: tx.counterparty,
          tags: tx.tags,
        },
        proposedChanges: matches ? updates : null,
      };
    });

    return {
      rule: {
        id: rule.id,
        name: rule.name,
      },
      results,
      summary: {
        total: results.length,
        matched: results.filter((r) => r.matched).length,
        noMatch: results.filter((r) => !r.matched).length,
      },
    };
  }

  async applyRulesToTransaction(transactionId: string) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({
      where: { id: transactionId },
      include: { account: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const rules = await this.prisma.cashFlowRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    let updates: any = {};
    let matchedRules: string[] = [];

    for (const rule of rules) {
      const matches = this.evaluateRule(rule, transaction);
      if (matches) {
        matchedRules.push(rule.id);

        if (rule.targetCategory && !updates.category) {
          updates.category = rule.targetCategory;
        }
        if (rule.targetCounterparty && !updates.counterparty) {
          updates.counterparty = rule.targetCounterparty;
        }
        if (rule.addTags && rule.addTags.length > 0) {
          updates.tags = [...new Set([...(updates.tags || transaction.tags), ...rule.addTags])];
        }

        // Stop at first match if not accumulating
        if (Object.keys(updates).length > 0) {
          break;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      return this.prisma.cashFlowTransaction.update({
        where: { id: transactionId },
        data: updates,
      });
    }

    return transaction;
  }

  private evaluateRule(rule: any, transaction: any): boolean {
    // Check account IDs
    if (rule.accountIds && rule.accountIds.length > 0) {
      if (!rule.accountIds.includes(transaction.accountId)) {
        return false;
      }
    }

    // Check categories
    if (rule.categories && rule.categories.length > 0) {
      if (!rule.categories.includes(transaction.category)) {
        return false;
      }
    }

    // Check amount range
    if (rule.amountMin !== null && rule.amountMin !== undefined) {
      if (transaction.amount < rule.amountMin) {
        return false;
      }
    }
    if (rule.amountMax !== null && rule.amountMax !== undefined) {
      if (transaction.amount > rule.amountMax) {
        return false;
      }
    }

    // Check counterparty regex
    if (rule.counterpartyRegex && transaction.counterparty) {
      try {
        const regex = new RegExp(rule.counterpartyRegex, 'i');
        if (!regex.test(transaction.counterparty)) {
          return false;
        }
      } catch (error) {
        return false; // Invalid regex
      }
    }

    // Check memo regex
    if (rule.memoRegex && transaction.memo) {
      try {
        const regex = new RegExp(rule.memoRegex, 'i');
        if (!regex.test(transaction.memo)) {
          return false;
        }
      } catch (error) {
        return false; // Invalid regex
      }
    }

    return true; // All conditions passed
  }
}

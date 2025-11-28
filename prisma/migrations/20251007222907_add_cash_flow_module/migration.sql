-- CreateEnum
CREATE TYPE "public"."CashFlowAccountType" AS ENUM ('BANK', 'CASH', 'CREDIT_CARD', 'INVESTMENT', 'LOAN_RECEIVABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."CashFlowTransactionType" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "public"."CashFlowCategory" AS ENUM ('CUSTOMER_PAYMENT', 'VENDOR_PAYMENT', 'SALARY_PAYMENT', 'RENT_PAYMENT', 'UTILITIES_PAYMENT', 'TAX_PAYMENT', 'INTEREST_PAYMENT', 'SERVICE_PAYMENT', 'ASSET_PURCHASE', 'ASSET_SALE', 'INVESTMENT_PURCHASE', 'INVESTMENT_SALE', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT_RECEIVED', 'EQUITY_INJECTION', 'EQUITY_WITHDRAWAL', 'LOAN_RECEIVED', 'LOAN_REPAYMENT_MADE', 'DIVIDEND_PAYMENT', 'TRANSFER', 'ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateTable
CREATE TABLE "public"."CashFlowAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "public"."CashFlowAccountType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlowAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashFlowTransaction" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "public"."CashFlowTransactionType" NOT NULL,
    "category" "public"."CashFlowCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "date" TIMESTAMP(3) NOT NULL,
    "counterparty" TEXT,
    "memo" TEXT,
    "reference" TEXT,
    "tags" TEXT[],
    "attachmentUrls" TEXT[],
    "metadata" JSONB,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "transferId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashFlowTransfer" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "date" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "debitTxId" TEXT NOT NULL,
    "creditTxId" TEXT NOT NULL,

    CONSTRAINT "CashFlowTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashFlowRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accountIds" TEXT[],
    "counterpartyRegex" TEXT,
    "memoRegex" TEXT,
    "amountMin" DOUBLE PRECISION,
    "amountMax" DOUBLE PRECISION,
    "categories" "public"."CashFlowCategory"[],
    "targetCategory" "public"."CashFlowCategory",
    "targetCounterparty" TEXT,
    "addTags" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlowRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CashFlowScheduledItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."CashFlowTransactionType" NOT NULL,
    "category" "public"."CashFlowCategory" NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "frequency" "public"."ScheduleFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextOccurrence" TIMESTAMP(3) NOT NULL,
    "counterparty" TEXT,
    "memo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlowScheduledItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashFlowTransaction_idempotencyKey_key" ON "public"."CashFlowTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CashFlowTransaction_accountId_date_idx" ON "public"."CashFlowTransaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "CashFlowTransaction_category_date_idx" ON "public"."CashFlowTransaction"("category", "date");

-- CreateIndex
CREATE INDEX "CashFlowTransaction_counterparty_idx" ON "public"."CashFlowTransaction"("counterparty");

-- CreateIndex
CREATE INDEX "CashFlowTransaction_date_idx" ON "public"."CashFlowTransaction"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CashFlowTransfer_idempotencyKey_key" ON "public"."CashFlowTransfer"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CashFlowTransfer_debitTxId_key" ON "public"."CashFlowTransfer"("debitTxId");

-- CreateIndex
CREATE UNIQUE INDEX "CashFlowTransfer_creditTxId_key" ON "public"."CashFlowTransfer"("creditTxId");

-- CreateIndex
CREATE INDEX "CashFlowTransfer_fromAccountId_date_idx" ON "public"."CashFlowTransfer"("fromAccountId", "date");

-- CreateIndex
CREATE INDEX "CashFlowTransfer_toAccountId_date_idx" ON "public"."CashFlowTransfer"("toAccountId", "date");

-- CreateIndex
CREATE INDEX "CashFlowRule_priority_idx" ON "public"."CashFlowRule"("priority");

-- CreateIndex
CREATE INDEX "CashFlowScheduledItem_nextOccurrence_isActive_idx" ON "public"."CashFlowScheduledItem"("nextOccurrence", "isActive");

-- CreateIndex
CREATE INDEX "CashFlowScheduledItem_accountId_idx" ON "public"."CashFlowScheduledItem"("accountId");

-- CreateIndex
CREATE INDEX "ExchangeRate_fromCurrency_toCurrency_effectiveDate_idx" ON "public"."ExchangeRate"("fromCurrency", "toCurrency", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrency_toCurrency_effectiveDate_key" ON "public"."ExchangeRate"("fromCurrency", "toCurrency", "effectiveDate");

-- AddForeignKey
ALTER TABLE "public"."CashFlowTransaction" ADD CONSTRAINT "CashFlowTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."CashFlowAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CashFlowTransfer" ADD CONSTRAINT "CashFlowTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "public"."CashFlowAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CashFlowTransfer" ADD CONSTRAINT "CashFlowTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "public"."CashFlowAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

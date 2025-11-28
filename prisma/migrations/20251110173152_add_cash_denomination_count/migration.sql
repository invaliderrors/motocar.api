-- CreateTable
CREATE TABLE "CashDenominationCount" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "bills_100000" INTEGER NOT NULL DEFAULT 0,
    "bills_50000" INTEGER NOT NULL DEFAULT 0,
    "bills_20000" INTEGER NOT NULL DEFAULT 0,
    "bills_10000" INTEGER NOT NULL DEFAULT 0,
    "bills_5000" INTEGER NOT NULL DEFAULT 0,
    "bills_2000" INTEGER NOT NULL DEFAULT 0,
    "bills_1000" INTEGER NOT NULL DEFAULT 0,
    "coins_500" INTEGER NOT NULL DEFAULT 0,
    "coins_200" INTEGER NOT NULL DEFAULT 0,
    "coins_100" INTEGER NOT NULL DEFAULT 0,
    "totalCounted" DOUBLE PRECISION NOT NULL,
    "systemCash" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "bankDeposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankWithdrawal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashDenominationCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashDenominationCount_cashRegisterId_key" ON "CashDenominationCount"("cashRegisterId");

-- CreateIndex
CREATE INDEX "CashDenominationCount_storeId_idx" ON "CashDenominationCount"("storeId");

-- CreateIndex
CREATE INDEX "CashDenominationCount_cashRegisterId_idx" ON "CashDenominationCount"("cashRegisterId");

-- AddForeignKey
ALTER TABLE "CashDenominationCount" ADD CONSTRAINT "CashDenominationCount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDenominationCount" ADD CONSTRAINT "CashDenominationCount_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

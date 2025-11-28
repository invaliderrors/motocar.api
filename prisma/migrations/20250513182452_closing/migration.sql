-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "cashRegisterId" TEXT;

-- CreateTable
CREATE TABLE "CashRegister" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashInRegister" DOUBLE PRECISION NOT NULL,
    "cashFromTransfers" DOUBLE PRECISION NOT NULL,
    "cashFromCards" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

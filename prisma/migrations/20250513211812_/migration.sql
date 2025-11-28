-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_cashRegisterId_fkey";

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "cashRegisterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

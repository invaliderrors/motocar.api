-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

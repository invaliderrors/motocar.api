-- AlterTable
ALTER TABLE "CashRegister" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

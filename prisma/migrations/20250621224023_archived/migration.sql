-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

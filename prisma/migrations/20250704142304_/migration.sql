-- DropIndex
DROP INDEX "Loan_contractNumber_key";

-- AlterTable
ALTER TABLE "Loan" ALTER COLUMN "contractNumber" DROP NOT NULL;

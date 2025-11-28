-- AlterEnum
ALTER TYPE "LoanStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Motorcycle" ADD COLUMN     "price" DOUBLE PRECISION;

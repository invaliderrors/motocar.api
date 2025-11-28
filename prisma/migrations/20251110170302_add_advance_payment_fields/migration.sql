-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "advancePaymentDate" TIMESTAMP(3),
ADD COLUMN     "isAdvance" BOOLEAN NOT NULL DEFAULT false;

/*
  Warnings:

  - Added the required column `dailyPaymentAmount` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `downPayment` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `interestRate` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `interestType` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentFrequency` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "dailyPaymentAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "downPayment" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "interestRate" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "interestType" TEXT NOT NULL,
ADD COLUMN     "paymentFrequency" TEXT NOT NULL;

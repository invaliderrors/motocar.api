/*
  Warnings:

  - Added the required column `paymentMethod` to the `Installment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CASH', 'TRANSACTION');

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL;

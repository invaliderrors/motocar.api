/*
  Warnings:

  - You are about to drop the column `dailyPaymentAmount` on the `Loan` table. All the data in the column will be lost.
  - Added the required column `installmentPaymentAmmount` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "dailyPaymentAmount",
ADD COLUMN     "installmentPaymentAmmount" DOUBLE PRECISION NOT NULL;

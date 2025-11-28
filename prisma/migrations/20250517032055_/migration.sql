/*
  Warnings:

  - A unique constraint covering the columns `[contractNumber]` on the table `Loan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contractNumber` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "contractNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Loan_contractNumber_key" ON "Loan"("contractNumber");

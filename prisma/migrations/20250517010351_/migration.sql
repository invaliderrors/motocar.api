/*
  Warnings:

  - Added the required column `provider` to the `CashRegister` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CashRegister" ADD COLUMN     "provider" "Providers" NOT NULL;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "provivder" "Providers";

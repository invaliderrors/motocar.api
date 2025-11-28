/*
  Warnings:

  - The values [OFICINA,SERVICIOS,MANTENIMIENTO,OTROS] on the enum `ExpenseCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `expenseDate` on the `Expense` table. All the data in the column will be lost.
  - Added the required column `beneficiary` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ExpenseCategory_new" AS ENUM ('RENT', 'SERVICES', 'SALARIES', 'TAXES', 'MAINTENANCE', 'PURCHASES', 'MARKETING', 'TRANSPORT', 'OTHER');
ALTER TABLE "Expense" ALTER COLUMN "category" TYPE "ExpenseCategory_new" USING ("category"::text::"ExpenseCategory_new");
ALTER TYPE "ExpenseCategory" RENAME TO "ExpenseCategory_old";
ALTER TYPE "ExpenseCategory_new" RENAME TO "ExpenseCategory";
DROP TYPE "ExpenseCategory_old";
COMMIT;

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "expenseDate",
ADD COLUMN     "attachments" TEXT[],
ADD COLUMN     "beneficiary" TEXT NOT NULL,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "reference" TEXT;

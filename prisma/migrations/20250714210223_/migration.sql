/*
  Warnings:

  - You are about to drop the column `provider` on the `CashRegister` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `Motorcycle` table. All the data in the column will be lost.
  - Added the required column `providerId` to the `CashRegister` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerId` to the `Motorcycle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CashRegister" DROP COLUMN "provider",
ADD COLUMN     "providerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "provider",
ADD COLUMN     "providerId" TEXT;

-- AlterTable
ALTER TABLE "Motorcycle" DROP COLUMN "provider",
ADD COLUMN     "providerId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "Providers";

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_name_key" ON "Provider"("name");

-- AddForeignKey
ALTER TABLE "Motorcycle" ADD CONSTRAINT "Motorcycle_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

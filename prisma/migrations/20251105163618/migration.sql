/*
  Warnings:

  - You are about to drop the `Owners` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";

-- DropForeignKey
ALTER TABLE "CashRegister" DROP CONSTRAINT "CashRegister_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Installment" DROP CONSTRAINT "Installment_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Owners" DROP CONSTRAINT "Owners_storeId_fkey";

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "whatsappApiKey" TEXT,
ADD COLUMN     "whatsappApiUrl" TEXT,
ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappInstanceId" TEXT;

-- DropTable
DROP TABLE "Owners";

-- CreateTable
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "storeId" TEXT,
    "permissions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccess" TIMESTAMP(3),
    "refreshToken" TEXT,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owners_username_key" ON "owners"("username");

-- CreateIndex
CREATE UNIQUE INDEX "owners_email_key" ON "owners"("email");

-- CreateIndex
CREATE INDEX "owners_storeId_idx" ON "owners"("storeId");

-- CreateIndex
CREATE INDEX "owners_role_idx" ON "owners"("role");

-- CreateIndex
CREATE INDEX "owners_status_idx" ON "owners"("status");

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

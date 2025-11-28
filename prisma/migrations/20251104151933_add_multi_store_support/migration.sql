/*
  Warnings:

  - You are about to drop the column `roles` on the `Owners` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `Owners` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,storeId]` on the table `Provider` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[identification,storeId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `storeId` to the `CashRegister` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `Installment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `Provider` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('IN_CIRCULATION', 'IN_WORKSHOP', 'SEIZED_BY_PROSECUTOR');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'TRANSFER', 'REASSIGN', 'LOGIN', 'LOGOUT', 'EXPORT', 'VIEW_SENSITIVE', 'ARCHIVE', 'RESTORE');

-- DropIndex
DROP INDEX "public"."Provider_name_key";

-- DropIndex
DROP INDEX "public"."User_identification_key";

-- AlterTable
ALTER TABLE "CashRegister" ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Owners" DROP COLUMN "roles",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "permissions" JSONB,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "storeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "status" "VehicleStatus" NOT NULL DEFAULT 'IN_CIRCULATION',
ADD COLUMN     "storeId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT,
    "status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_name_key" ON "Store"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- CreateIndex
CREATE INDEX "Store_status_idx" ON "Store"("status");

-- CreateIndex
CREATE INDEX "Store_code_idx" ON "Store"("code");

-- CreateIndex
CREATE INDEX "AuditLog_storeId_idx" ON "AuditLog"("storeId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "CashRegister_storeId_idx" ON "CashRegister"("storeId");

-- CreateIndex
CREATE INDEX "CashRegister_storeId_date_idx" ON "CashRegister"("storeId", "date");

-- CreateIndex
CREATE INDEX "CashRegister_providerId_idx" ON "CashRegister"("providerId");

-- CreateIndex
CREATE INDEX "Expense_storeId_idx" ON "Expense"("storeId");

-- CreateIndex
CREATE INDEX "Expense_storeId_date_idx" ON "Expense"("storeId", "date");

-- CreateIndex
CREATE INDEX "Installment_storeId_idx" ON "Installment"("storeId");

-- CreateIndex
CREATE INDEX "Installment_storeId_paymentDate_idx" ON "Installment"("storeId", "paymentDate");

-- CreateIndex
CREATE INDEX "Installment_loanId_idx" ON "Installment"("loanId");

-- CreateIndex
CREATE INDEX "Loan_storeId_idx" ON "Loan"("storeId");

-- CreateIndex
CREATE INDEX "Loan_storeId_status_idx" ON "Loan"("storeId", "status");

-- CreateIndex
CREATE INDEX "Loan_storeId_archived_idx" ON "Loan"("storeId", "archived");

-- CreateIndex
CREATE INDEX "Loan_userId_idx" ON "Loan"("userId");

-- CreateIndex
CREATE INDEX "Loan_vehicleId_idx" ON "Loan"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Owners_email_key" ON "Owners"("email");

-- CreateIndex
CREATE INDEX "Owners_storeId_idx" ON "Owners"("storeId");

-- CreateIndex
CREATE INDEX "Owners_role_idx" ON "Owners"("role");

-- CreateIndex
CREATE INDEX "Owners_status_idx" ON "Owners"("status");

-- CreateIndex
CREATE INDEX "Provider_storeId_idx" ON "Provider"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_name_storeId_key" ON "Provider"("name", "storeId");

-- CreateIndex
CREATE INDEX "User_storeId_idx" ON "User"("storeId");

-- CreateIndex
CREATE INDEX "User_storeId_identification_idx" ON "User"("storeId", "identification");

-- CreateIndex
CREATE UNIQUE INDEX "User_identification_storeId_key" ON "User"("identification", "storeId");

-- CreateIndex
CREATE INDEX "Vehicle_storeId_idx" ON "Vehicle"("storeId");

-- CreateIndex
CREATE INDEX "Vehicle_storeId_status_idx" ON "Vehicle"("storeId", "status");

-- CreateIndex
CREATE INDEX "Vehicle_providerId_idx" ON "Vehicle"("providerId");

-- AddForeignKey
ALTER TABLE "Owners" ADD CONSTRAINT "Owners_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

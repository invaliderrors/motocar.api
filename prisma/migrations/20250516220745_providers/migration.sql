/*
  Warnings:

  - Added the required column `updatedAt` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider` to the `Motorcycle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Motorcycle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Providers" AS ENUM ('MOTOFACIL', 'OBRASOCIAL', 'PORCENTAJETITO');

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Motorcycle" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

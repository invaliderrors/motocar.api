/*
  Warnings:

  - Added the required column `gps` to the `Installment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "gps" DOUBLE PRECISION NOT NULL;

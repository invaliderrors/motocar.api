/*
  Warnings:

  - A unique constraint covering the columns `[nit]` on the table `Store` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nit` to the `Store` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "nit" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Store_nit_key" ON "Store"("nit");

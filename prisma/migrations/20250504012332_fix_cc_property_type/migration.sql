/*
  Warnings:

  - The `cc` column on the `Motorcycle` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Motorcycle" DROP COLUMN "cc",
ADD COLUMN     "cc" INTEGER;

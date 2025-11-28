/*
  Warnings:

  - Added the required column `chassis` to the `Motorcycle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `engine` to the `Motorcycle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Motorcycle" ADD COLUMN     "chassis" TEXT NOT NULL,
ADD COLUMN     "engine" TEXT NOT NULL;

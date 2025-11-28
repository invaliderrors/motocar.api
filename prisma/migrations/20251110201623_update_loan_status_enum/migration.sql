/*
  Warnings:

  - The values [ARCHIVED,ARCHIVED_BY_DEFAULT,ARCHIVED_BY_THEFT,ARCHIVED_BY_PROSECUTOR] on the enum `LoanStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LoanStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'DEFAULTED', 'RESTARTED_BY_DEFAULT', 'COMPLETED_BY_THEFT', 'COMPLETED_BY_PROSECUTOR');
ALTER TABLE "public"."Loan" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Loan" ALTER COLUMN "status" TYPE "LoanStatus_new" USING ("status"::text::"LoanStatus_new");
ALTER TYPE "LoanStatus" RENAME TO "LoanStatus_old";
ALTER TYPE "LoanStatus_new" RENAME TO "LoanStatus";
DROP TYPE "public"."LoanStatus_old";
ALTER TABLE "Loan" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "riskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[];

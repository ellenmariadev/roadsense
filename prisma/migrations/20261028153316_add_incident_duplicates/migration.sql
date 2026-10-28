-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "incident_duplicates" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "duplicateIncidentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "signals" JSONB NOT NULL,
    "status" "DuplicateStatus" NOT NULL DEFAULT 'CONFIRMED',
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "incident_duplicates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_duplicates_incidentId_idx" ON "incident_duplicates"("incidentId");

-- CreateIndex
CREATE INDEX "incident_duplicates_duplicateIncidentId_idx" ON "incident_duplicates"("duplicateIncidentId");

-- CreateIndex
CREATE UNIQUE INDEX "incident_duplicates_incidentId_duplicateIncidentId_key" ON "incident_duplicates"("incidentId", "duplicateIncidentId");

-- AddForeignKey
ALTER TABLE "incident_duplicates" ADD CONSTRAINT "incident_duplicates_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_duplicates" ADD CONSTRAINT "incident_duplicates_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_duplicates" ADD CONSTRAINT "incident_duplicates_duplicateIncidentId_fkey" FOREIGN KEY ("duplicateIncidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

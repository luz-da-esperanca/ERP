ALTER TYPE "AuditAction" ADD VALUE 'CANCEL';
ALTER TYPE "AuditAction" ADD VALUE 'INVALIDATE';
-- CreateTable
CREATE TABLE "ActivitySession" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "responsibleId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" UUID NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'COMPLETED',
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "membershipRevision" INTEGER NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersededById" UUID,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCoverage" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEndExclusive" DATE NOT NULL,
    "declaredBy" UUID NOT NULL,
    "declaredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceVersions" JSONB NOT NULL,
    "invalidatedPeriods" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AttendanceCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivitySession_activityId_occurredAt_idx" ON "ActivitySession"("activityId", "occurredAt");

-- CreateIndex
CREATE INDEX "Attendance_personId_sessionId_idx" ON "Attendance"("personId", "sessionId");

-- CreateIndex
CREATE INDEX "Attendance_membershipId_idx" ON "Attendance"("membershipId");

-- CreateIndex
CREATE INDEX "AttendanceCoverage_activityId_periodStart_periodEndExclusiv_idx" ON "AttendanceCoverage"("activityId", "periodStart", "periodEndExclusive");

-- AddForeignKey
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "FamilyMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCoverage" ADD CONSTRAINT "AttendanceCoverage_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCoverage" ADD CONSTRAINT "AttendanceCoverage_declaredBy_fkey" FOREIGN KEY ("declaredBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_valid_status" CHECK (status IN ('COMPLETED', 'CANCELED'));
ALTER TABLE "Attendance"
  ADD CONSTRAINT "Attendance_valid_status" CHECK (status IN ('PRESENT', 'ABSENT')),
  ADD CONSTRAINT "Attendance_valid_membership_revision" CHECK ("membershipRevision" > 0);
CREATE UNIQUE INDEX "Attendance_effective_person_key" ON "Attendance" ("sessionId", "personId") WHERE "supersededById" IS NULL;
ALTER TABLE "AttendanceCoverage" ADD CONSTRAINT "AttendanceCoverage_valid_period" CHECK ("periodStart" < "periodEndExclusive");

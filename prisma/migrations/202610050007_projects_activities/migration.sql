-- CreateTable
CREATE TABLE "Institute" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Institute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceType" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ServiceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "nameSearch" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000),
    "instituteId" UUID NOT NULL,
    "startsOn" DATE,
    "endsOn" DATE,
    "status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "nameSearch" VARCHAR(200) NOT NULL,
    "nature" VARCHAR(10) NOT NULL,
    "serviceTypeId" UUID,
    "plannedSchedule" VARCHAR(500),
    "responsibleId" UUID,
    "status" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantEnrollment" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "validFrom" TIMESTAMPTZ(3) NOT NULL,
    "validUntil" TIMESTAMPTZ(3),
    "supersededById" UUID,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "ParticipantEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institute_code_key" ON "Institute"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceType_code_key" ON "ServiceType"("code");

-- CreateIndex
CREATE INDEX "ParticipantEnrollment_activityId_validFrom_idx" ON "ParticipantEnrollment"("activityId", "validFrom");

-- CreateIndex
CREATE INDEX "ParticipantEnrollment_personId_validFrom_idx" ON "ParticipantEnrollment"("personId", "validFrom");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEnrollment" ADD CONSTRAINT "ParticipantEnrollment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEnrollment" ADD CONSTRAINT "ParticipantEnrollment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEnrollment" ADD CONSTRAINT "ParticipantEnrollment_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "ParticipantEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEnrollment" ADD CONSTRAINT "ParticipantEnrollment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantEnrollment" ADD CONSTRAINT "ParticipantEnrollment_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_valid_period" CHECK ("startsOn" IS NULL OR "endsOn" IS NULL OR "startsOn" <= "endsOn"),
  ADD CONSTRAINT "Project_valid_status" CHECK ((status = 'ACTIVE' AND "closedAt" IS NULL) OR (status = 'CLOSED' AND "closedAt" IS NOT NULL));
ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_valid_status" CHECK ((status = 'ACTIVE' AND "closedAt" IS NULL) OR (status = 'CLOSED' AND "closedAt" IS NOT NULL)),
  ADD CONSTRAINT "Activity_valid_nature" CHECK ((nature = 'PERIODIC' AND "serviceTypeId" IS NULL) OR (nature = 'ONE_OFF' AND "serviceTypeId" IS NOT NULL));
ALTER TABLE "ParticipantEnrollment"
  ADD CONSTRAINT "ParticipantEnrollment_valid_interval" CHECK ("validUntil" IS NULL OR "validFrom" < "validUntil"),
  ADD CONSTRAINT "ParticipantEnrollment_period_exclusion"
    EXCLUDE USING gist ("activityId" WITH =, "personId" WITH =, tstzrange("validFrom", "validUntil", '[)') WITH &&)
    WHERE ("supersededById" IS NULL) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION prevent_catalog_code_update() RETURNS trigger AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Catalog codes are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Institute_code_immutable" BEFORE UPDATE OF code ON "Institute" FOR EACH ROW EXECUTE FUNCTION prevent_catalog_code_update();
CREATE TRIGGER "ServiceType_code_immutable" BEFORE UPDATE OF code ON "ServiceType" FOR EACH ROW EXECUTE FUNCTION prevent_catalog_code_update();

INSERT INTO "Institute" (id, code, name) VALUES
  (gen_random_uuid(), 'CHILD', 'Criança'),
  (gen_random_uuid(), 'YOUTH', 'Jovem'),
  (gen_random_uuid(), 'EDUCATION_FAMILY', 'Esclarecimento e Família'),
  (gen_random_uuid(), 'CHARITY', 'Caridade'),
  (gen_random_uuid(), 'COMMUNICATION', 'Divulgação'),
  (gen_random_uuid(), 'MEDIUMSHIP', 'Mediunidade');

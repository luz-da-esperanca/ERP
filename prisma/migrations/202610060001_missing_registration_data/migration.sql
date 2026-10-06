BEGIN;

CREATE TABLE "RegistrationFieldSelection" (
  "id" UUID NOT NULL,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "personFields" TEXT[] NOT NULL,
  "familyFields" TEXT[] NOT NULL,
  "decisionReference" VARCHAR(1000) NOT NULL CHECK (length(btrim("decisionReference")) > 0),
  "recordedAt" TIMESTAMPTZ(3) NOT NULL,
  "recordedBy" UUID NOT NULL REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RegistrationFieldSelection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RegistrationFieldSelection_version_key" ON "RegistrationFieldSelection"("version");
CREATE UNIQUE INDEX "DataQualityIssue_open_missing_field_key"
  ON "DataQualityIssue" ("entityType", "entityId", ("fieldKeys"[1]))
  WHERE "kind" = 'MISSING_DATA' AND "resolvedAt" IS NULL;
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_missing_single_field"
  CHECK ("kind" <> 'MISSING_DATA' OR cardinality("fieldKeys") = 1);
CREATE FUNCTION reject_registration_selection_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registration field selections are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER registration_selection_immutable BEFORE UPDATE OR DELETE ON "RegistrationFieldSelection"
  FOR EACH ROW EXECUTE FUNCTION reject_registration_selection_mutation();

COMMIT;

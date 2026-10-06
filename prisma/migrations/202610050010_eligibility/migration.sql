-- CreateTable
CREATE TABLE "EligibilityPolicy" (
    "id" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "definition" JSONB NOT NULL,
    "decisionReference" VARCHAR(2000) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" UUID NOT NULL,

    CONSTRAINT "EligibilityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityAssessment" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "referenceDate" DATE NOT NULL,
    "evaluatedAt" TIMESTAMPTZ(3) NOT NULL,
    "policyId" UUID,
    "status" VARCHAR(10) NOT NULL,
    "pendingReasons" TEXT[],
    "explanation" JSONB NOT NULL,
    "sourceFingerprint" VARCHAR(64) NOT NULL,
    "requestedBy" UUID NOT NULL,

    CONSTRAINT "EligibilityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityEvidence" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "personId" UUID NOT NULL,
    "membershipIds" UUID[],
    "activityIds" UUID[],
    "periodStart" DATE NOT NULL,
    "periodEndExclusive" DATE NOT NULL,
    "sessionCount" INTEGER NOT NULL,
    "presenceCount" INTEGER NOT NULL,
    "absenceCount" INTEGER NOT NULL,
    "unrecordedCount" INTEGER NOT NULL,
    "rateLowerBasisPoints" INTEGER,
    "rateUpperBasisPoints" INTEGER,
    "coverageComplete" BOOLEAN NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "pendingReason" VARCHAR(40),
    "sourceVersions" JSONB NOT NULL,

    CONSTRAINT "EligibilityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityPolicy_effectiveFrom_key" ON "EligibilityPolicy"("effectiveFrom");

-- CreateIndex
CREATE INDEX "EligibilityAssessment_familyId_referenceDate_idx" ON "EligibilityAssessment"("familyId", "referenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityEvidence_assessmentId_position_key" ON "EligibilityEvidence"("assessmentId", "position");

-- AddForeignKey
ALTER TABLE "EligibilityPolicy" ADD CONSTRAINT "EligibilityPolicy_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityAssessment" ADD CONSTRAINT "EligibilityAssessment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityAssessment" ADD CONSTRAINT "EligibilityAssessment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "EligibilityPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityAssessment" ADD CONSTRAINT "EligibilityAssessment_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityEvidence" ADD CONSTRAINT "EligibilityEvidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "EligibilityAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityEvidence" ADD CONSTRAINT "EligibilityEvidence_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "EligibilityAssessment"
  ADD CONSTRAINT "EligibilityAssessment_valid_status" CHECK (status IN ('ELIGIBLE', 'INELIGIBLE', 'PENDING')),
  -- A conclusion always identifies its criterion; only a pending result may lack one.
  ADD CONSTRAINT "EligibilityAssessment_conclusion_has_policy" CHECK (status = 'PENDING' OR "policyId" IS NOT NULL),
  ADD CONSTRAINT "EligibilityAssessment_pending_has_reason" CHECK ((status = 'PENDING') = (cardinality("pendingReasons") > 0));
ALTER TABLE "EligibilityEvidence"
  ADD CONSTRAINT "EligibilityEvidence_valid_status" CHECK (status IN ('ELIGIBLE', 'INELIGIBLE', 'PENDING')),
  ADD CONSTRAINT "EligibilityEvidence_pending_has_reason" CHECK ((status = 'PENDING') = ("pendingReason" IS NOT NULL)),
  ADD CONSTRAINT "EligibilityEvidence_valid_period" CHECK ("periodStart" < "periodEndExclusive"),
  ADD CONSTRAINT "EligibilityEvidence_valid_counts" CHECK (
    "presenceCount" >= 0 AND "absenceCount" >= 0 AND "unrecordedCount" >= 0
    AND "sessionCount" = "presenceCount" + "absenceCount" + "unrecordedCount"
  );

CREATE FUNCTION reject_eligibility_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published policies and saved assessments are immutable';
END;
$$;
CREATE TRIGGER "EligibilityPolicy_immutable" BEFORE UPDATE OR DELETE ON "EligibilityPolicy" FOR EACH ROW EXECUTE FUNCTION reject_eligibility_mutation();
CREATE TRIGGER "EligibilityAssessment_immutable" BEFORE UPDATE OR DELETE ON "EligibilityAssessment" FOR EACH ROW EXECUTE FUNCTION reject_eligibility_mutation();
CREATE TRIGGER "EligibilityEvidence_immutable" BEFORE UPDATE OR DELETE ON "EligibilityEvidence" FOR EACH ROW EXECUTE FUNCTION reject_eligibility_mutation();

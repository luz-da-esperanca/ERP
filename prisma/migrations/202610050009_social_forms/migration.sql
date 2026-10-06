-- AlterTable
-- Backfill existing recorded decisions without changing their references or authors.
ALTER TABLE "FeatureDecision" ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "FeatureDecision" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FieldSelectionVersion" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedBy" UUID NOT NULL,
    "decisionReference" VARCHAR(2000) NOT NULL,
    "fields" JSONB NOT NULL,

    CONSTRAINT "FieldSelectionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialFormOption" (
    "id" UUID NOT NULL,
    "fieldKey" VARCHAR(100) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SocialFormOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialForm" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "previousVersionId" UUID,
    "correctionOfFormId" UUID,
    "referenceMemberId" UUID,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedBy" UUID NOT NULL,
    "fieldSelectionVersionId" UUID NOT NULL,
    "familySnapshot" JSONB NOT NULL,
    "blocks" JSONB NOT NULL,
    "reason" VARCHAR(1000),

    CONSTRAINT "SocialForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormMember" (
    "id" UUID NOT NULL,
    "socialFormId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "membershipRevision" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "FormMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acknowledgement" (
    "id" UUID NOT NULL,
    "socialFormId" UUID NOT NULL,
    "referencePersonId" UUID NOT NULL,
    "method" VARCHAR(100) NOT NULL,
    "acknowledgedOn" DATE NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedBy" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Acknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FieldSelectionVersion_version_key" ON "FieldSelectionVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "SocialFormOption_fieldKey_code_key" ON "SocialFormOption"("fieldKey", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SocialForm_previousVersionId_key" ON "SocialForm"("previousVersionId");

-- CreateIndex
CREATE INDEX "SocialForm_familyId_recordedAt_idx" ON "SocialForm"("familyId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialForm_familyId_version_key" ON "SocialForm"("familyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FormMember_socialFormId_personId_key" ON "FormMember"("socialFormId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Acknowledgement_socialFormId_key" ON "Acknowledgement"("socialFormId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureDecision_id_key" ON "FeatureDecision"("id");

-- AddForeignKey
ALTER TABLE "FieldSelectionVersion" ADD CONSTRAINT "FieldSelectionVersion_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialForm" ADD CONSTRAINT "SocialForm_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialForm" ADD CONSTRAINT "SocialForm_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "SocialForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialForm" ADD CONSTRAINT "SocialForm_correctionOfFormId_fkey" FOREIGN KEY ("correctionOfFormId") REFERENCES "SocialForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialForm" ADD CONSTRAINT "SocialForm_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialForm" ADD CONSTRAINT "SocialForm_fieldSelectionVersionId_fkey" FOREIGN KEY ("fieldSelectionVersionId") REFERENCES "FieldSelectionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormMember" ADD CONSTRAINT "FormMember_socialFormId_fkey" FOREIGN KEY ("socialFormId") REFERENCES "SocialForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormMember" ADD CONSTRAINT "FormMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormMember" ADD CONSTRAINT "FormMember_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "FamilyMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_socialFormId_fkey" FOREIGN KEY ("socialFormId") REFERENCES "SocialForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_referencePersonId_fkey" FOREIGN KEY ("referencePersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialForm" ADD CONSTRAINT "SocialForm_referenceMemberId_fkey" FOREIGN KEY ("referenceMemberId") REFERENCES "FormMember"("id") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_form_member_fkey" FOREIGN KEY ("socialFormId", "referencePersonId") REFERENCES "FormMember"("socialFormId", "personId") ON DELETE RESTRICT;
ALTER TABLE "FieldSelectionVersion" ADD CONSTRAINT "FieldSelectionVersion_valid" CHECK ("version" > 0 AND length(trim("decisionReference")) > 0 AND jsonb_typeof("fields") = 'array');
ALTER TABLE "SocialFormOption" ADD CONSTRAINT "SocialFormOption_valid" CHECK ("revision" > 0 AND "code" ~ '^[A-Z][A-Z0-9_]{0,99}$' AND length(trim("label")) > 0);
ALTER TABLE "SocialForm" ADD CONSTRAINT "SocialForm_version_base" CHECK (("version" = 1 AND "previousVersionId" IS NULL) OR ("version" > 1 AND "previousVersionId" IS NOT NULL));
ALTER TABLE "SocialForm" ADD CONSTRAINT "SocialForm_correction_reason" CHECK ("correctionOfFormId" IS NULL OR ("correctionOfFormId" <> "id" AND "reason" IS NOT NULL AND length(trim("reason")) > 0));
ALTER TABLE "FormMember" ADD CONSTRAINT "FormMember_protected_payload" CHECK ("membershipRevision" > 0 AND jsonb_typeof("payload") = 'object' AND NOT (("payload"->'blocks') ?| ARRAY['health', 'medications', 'religion']));
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_known_method" CHECK ("revision" > 0 AND "method" = 'PAPER_SIGNATURE');

CREATE FUNCTION reject_social_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published social records are immutable';
END;
$$;
CREATE TRIGGER "SocialForm_immutable" BEFORE UPDATE OR DELETE ON "SocialForm" FOR EACH ROW EXECUTE FUNCTION reject_social_version_mutation();
CREATE TRIGGER "FormMember_immutable" BEFORE UPDATE OR DELETE ON "FormMember" FOR EACH ROW EXECUTE FUNCTION reject_social_version_mutation();
CREATE TRIGGER "FieldSelectionVersion_immutable" BEFORE UPDATE OR DELETE ON "FieldSelectionVersion" FOR EACH ROW EXECUTE FUNCTION reject_social_version_mutation();

CREATE FUNCTION validate_social_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."previousVersionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "SocialForm" previous WHERE previous.id = NEW."previousVersionId" AND previous."familyId" = NEW."familyId" AND previous.version = NEW.version - 1
  ) THEN RAISE EXCEPTION 'Invalid social form predecessor'; END IF;
  IF NEW."referenceMemberId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "FormMember" member WHERE member.id = NEW."referenceMemberId" AND member."socialFormId" = NEW.id
  ) THEN RAISE EXCEPTION 'Reference member must belong to the published form'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER "SocialForm_valid_version" AFTER INSERT ON "SocialForm" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_social_version();

-- Candidate options from the source form do not enable collection.
INSERT INTO "SocialFormOption" ("id", "fieldKey", "code", "label", "active", "isOther", "revision") VALUES
(gen_random_uuid(), 'housing.housingTenure', 'OWNED', 'Própria', true, false, 1),
(gen_random_uuid(), 'housing.housingTenure', 'FINANCED', 'Financiada', true, false, 1),
(gen_random_uuid(), 'housing.housingTenure', 'RENTED', 'Alugada', true, false, 1),
(gen_random_uuid(), 'housing.housingTenure', 'PROVIDED', 'Cedida', true, false, 1),
(gen_random_uuid(), 'housing.housingTenure', 'OTHER', 'Outros', true, true, 1),
(gen_random_uuid(), 'housing.location', 'URBAN', 'Urbana', true, false, 1),
(gen_random_uuid(), 'housing.location', 'RURAL', 'Rural', true, false, 1),
(gen_random_uuid(), 'housing.dwellingType', 'HOUSE', 'Casa', true, false, 1),
(gen_random_uuid(), 'housing.dwellingType', 'APARTMENT', 'Apartamento', true, false, 1),
(gen_random_uuid(), 'housing.dwellingType', 'ROOM', 'Cômodo', true, false, 1),
(gen_random_uuid(), 'housing.dwellingType', 'OTHER', 'Outro', true, true, 1),
(gen_random_uuid(), 'housing.construction', 'BRICK_PLASTERED', 'Tijolo com reboco', true, false, 1),
(gen_random_uuid(), 'housing.construction', 'BRICK_UNPLASTERED', 'Tijolo sem reboco', true, false, 1),
(gen_random_uuid(), 'housing.construction', 'WATTLE_PLASTERED', 'Taipa com reboco', true, false, 1),
(gen_random_uuid(), 'housing.construction', 'WATTLE_UNPLASTERED', 'Taipa sem reboco', true, false, 1),
(gen_random_uuid(), 'housing.floorType', 'CEMENT', 'Cimento', true, false, 1),
(gen_random_uuid(), 'housing.floorType', 'CERAMIC', 'Cerâmica', true, false, 1),
(gen_random_uuid(), 'housing.floorType', 'EARTH', 'Chão batido', true, false, 1),
(gen_random_uuid(), 'housing.floorType', 'OTHER', 'Outro', true, true, 1),
(gen_random_uuid(), 'housing.electricity', 'BILL_PAID', 'Paga talão', true, false, 1),
(gen_random_uuid(), 'housing.electricity', 'NONE', 'Não possui', true, false, 1),
(gen_random_uuid(), 'housing.electricity', 'USED_UNPAID', 'Usa e não paga', true, false, 1),
(gen_random_uuid(), 'housing.electricity', 'NEIGHBOR_PROVIDED', 'Cedida por vizinho', true, false, 1),
(gen_random_uuid(), 'housing.electricity', 'IMPROVISED_METER', 'Contador improvisado', true, false, 1),
(gen_random_uuid(), 'housing.electricity', 'SOLAR_PANEL', 'Placa solar', true, false, 1),
(gen_random_uuid(), 'housing.waterSupply', 'BILL_PAID', 'Paga talão', true, false, 1),
(gen_random_uuid(), 'housing.waterSupply', 'UNPAID', 'Não paga', true, false, 1),
(gen_random_uuid(), 'housing.waterSupply', 'CISTERN', 'Cisterna', true, false, 1),
(gen_random_uuid(), 'housing.waterSupply', 'WATER_TRUCK', 'Carro-pipa', true, false, 1),
(gen_random_uuid(), 'housing.waterSupply', 'RIVER', 'Rio', true, false, 1),
(gen_random_uuid(), 'housing.waterSupply', 'WELL_SPRING', 'Poço/nascente', true, false, 1),
(gen_random_uuid(), 'housing.waterTreatment', 'FILTERED', 'Filtrada', true, false, 1),
(gen_random_uuid(), 'housing.waterTreatment', 'BOILED', 'Fervida', true, false, 1),
(gen_random_uuid(), 'housing.waterTreatment', 'CHLORINATED', 'Cloração', true, false, 1),
(gen_random_uuid(), 'housing.waterTreatment', 'UNTREATED', 'Sem tratamento', true, false, 1),
(gen_random_uuid(), 'housing.sewage', 'SEWER', 'Esgoto', true, false, 1),
(gen_random_uuid(), 'housing.sewage', 'SEPTIC_TANK', 'Fossa séptica', true, false, 1),
(gen_random_uuid(), 'housing.sewage', 'RUDIMENTARY_PIT', 'Fossa rudimentar', true, false, 1),
(gen_random_uuid(), 'housing.sewage', 'OPEN_AIR', 'Céu aberto', true, false, 1),
(gen_random_uuid(), 'housing.sewage', 'DIRECT_TO_RIVER', 'Direto para o rio', true, false, 1),
(gen_random_uuid(), 'housing.wasteDisposal', 'COLLECTED', 'Coletado', true, false, 1),
(gen_random_uuid(), 'housing.wasteDisposal', 'BURNED_BURIED', 'Queimado/enterrado', true, false, 1),
(gen_random_uuid(), 'housing.wasteDisposal', 'OPEN_AIR', 'Céu aberto', true, false, 1),
(gen_random_uuid(), 'housing.wasteDisposal', 'OTHER', 'Outro', true, true, 1),
(gen_random_uuid(), 'housing.transportation', 'PUBLIC_TRANSPORT', 'Transporte público', true, false, 1),
(gen_random_uuid(), 'housing.transportation', 'MOTORCYCLE_TAXI', 'Moto táxi', true, false, 1),
(gen_random_uuid(), 'housing.transportation', 'BICYCLE', 'Bicicleta', true, false, 1),
(gen_random_uuid(), 'housing.transportation', 'MOTORCYCLE_CAR', 'Moto/carro', true, false, 1),
(gen_random_uuid(), 'housing.hygiene', 'GOOD', 'Boa', true, false, 1),
(gen_random_uuid(), 'housing.hygiene', 'REGULAR', 'Regular', true, false, 1),
(gen_random_uuid(), 'housing.hygiene', 'POOR', 'Ruim', true, false, 1),
(gen_random_uuid(), 'needs.declaredNeeds', 'FOOD', 'Alimento', true, false, 1),
(gen_random_uuid(), 'needs.declaredNeeds', 'CLOTHING', 'Vestuário', true, false, 1),
(gen_random_uuid(), 'needs.declaredNeeds', 'FOOTWEAR', 'Calçado', true, false, 1),
(gen_random_uuid(), 'needs.declaredNeeds', 'EMPLOYMENT', 'Emprego', true, false, 1),
(gen_random_uuid(), 'needs.declaredNeeds', 'MEDICAL_SUPPORT', 'Médico', true, false, 1),
(gen_random_uuid(), 'needs.declaredNeeds', 'OTHER', 'Outros', true, true, 1);

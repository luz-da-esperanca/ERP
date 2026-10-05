CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "FamilyMembership"
  ADD CONSTRAINT "FamilyMembership_valid_interval"
    CHECK ("validUntil" IS NULL OR "validFrom" < "validUntil"),
  ADD CONSTRAINT "FamilyMembership_person_period_exclusion"
    EXCLUDE USING gist ("personId" WITH =, tstzrange("validFrom", "validUntil", '[)') WITH &&)
    WHERE ("supersededById" IS NULL) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "FamilyMembership_reference_period_exclusion"
    EXCLUDE USING gist ("familyId" WITH =, tstzrange("validFrom", "validUntil", '[)') WITH &&)
    WHERE ("isReference" AND "supersededById" IS NULL) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION prevent_family_code_update() RETURNS trigger AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Family codes are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Family_code_immutable"
  BEFORE UPDATE OF code ON "Family"
  FOR EACH ROW EXECUTE FUNCTION prevent_family_code_update();

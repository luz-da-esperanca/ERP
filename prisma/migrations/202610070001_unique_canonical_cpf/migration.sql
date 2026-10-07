DO $$
BEGIN
  IF EXISTS (
    SELECT cpf FROM "Person"
    WHERE cpf IS NOT NULL AND "mergedIntoId" IS NULL
    GROUP BY cpf HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Canonical people have duplicate CPF values; reconcile existing records before applying this migration';
  END IF;
END;
$$;

CREATE UNIQUE INDEX "Person_cpf_canonical_key"
  ON "Person" (cpf)
  WHERE cpf IS NOT NULL AND "mergedIntoId" IS NULL;

BEGIN;

-- Deployment drains catalog writers first. Hold all identity locks until the complete backfill commits.
LOCK TABLE stock_categories, stock_items, stock_sizes, stock_units IN ACCESS EXCLUSIVE MODE;

CREATE FUNCTION format_stock_catalog_code(resource_prefix text, allocated_value bigint)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT resource_prefix || '-' || repeat('0', greatest(0, 6 - length(allocated_value::text))) || allocated_value::text
$$;

CREATE FUNCTION next_stock_catalog_code(resource_prefix text, source_sequence regclass)
RETURNS text LANGUAGE plpgsql VOLATILE STRICT SECURITY INVOKER AS $$
DECLARE
  allocated_value bigint;
BEGIN
  allocated_value := nextval(source_sequence);
  RETURN format_stock_catalog_code(resource_prefix, allocated_value);
END;
$$;

CREATE FUNCTION is_valid_stock_catalog_code(candidate text, resource_prefix text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  suffix_value numeric;
BEGIN
  IF candidate !~ ('^' || resource_prefix || '-[0-9]{6,19}$') THEN
    RETURN false;
  END IF;
  suffix_value := substring(candidate FROM length(resource_prefix) + 2)::numeric;
  IF suffix_value < 1 OR suffix_value > 9223372036854775807 THEN
    RETURN false;
  END IF;
  RETURN candidate = format_stock_catalog_code(resource_prefix, suffix_value::bigint);
END;
$$;

CREATE FUNCTION prevent_stock_catalog_code_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Catalog codes are immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  resource record;
  existing_count bigint;
BEGIN
  FOR resource IN SELECT * FROM (VALUES
    ('stock_categories', 'CAT', 'stock_category_code_seq', 23),
    ('stock_items', 'ITEM', 'stock_item_code_seq', 24),
    ('stock_sizes', 'SIZE', 'stock_size_code_seq', 24),
    ('stock_units', 'UNIT', 'stock_unit_code_seq', 24)
  ) AS resources(table_name, prefix, sequence_name, code_length)
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN code varchar(%s)', resource.table_name, resource.code_length);
    EXECUTE format('CREATE SEQUENCE %I AS bigint START 1 INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE CACHE 1', resource.sequence_name);
    EXECUTE format(
      'WITH ordered AS (SELECT id, row_number() OVER (ORDER BY created_at, id) AS suffix FROM %I)
       UPDATE %I AS target SET code = format_stock_catalog_code(%L, ordered.suffix)
       FROM ordered WHERE target.id = ordered.id',
      resource.table_name, resource.table_name, resource.prefix
    );
    EXECUTE format('SELECT count(*) FROM %I', resource.table_name) INTO existing_count;
    PERFORM setval(resource.sequence_name::regclass, greatest(existing_count, 1), existing_count > 0);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN code SET NOT NULL, ALTER COLUMN code SET DEFAULT next_stock_catalog_code(%L::text, %L::regclass)',
      resource.table_name, resource.prefix, resource.sequence_name);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (code)', resource.table_name, resource.table_name || '_code_key');
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (is_valid_stock_catalog_code(code, %L))',
      resource.table_name, resource.table_name || '_code_canonical', resource.prefix);
    EXECUTE format('ALTER SEQUENCE %I OWNED BY %I.code', resource.sequence_name, resource.table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF code ON %I FOR EACH ROW EXECUTE FUNCTION prevent_stock_catalog_code_change()',
      resource.table_name || '_code_immutable', resource.table_name);
  END LOOP;
END;
$$;

COMMIT;

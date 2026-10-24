-- Patch only the verified validation expression of the existing live function.
-- Preserve all existing atomic-claim, abuse, deduplication, and outbox logic.
DO $migration$
DECLARE
  old_def text;
  new_def text;
  old_check text := '(select count(*) from jsonb_object_keys(p_input))<>11';
  new_check text := '(p_input ? ''aiConsent'' and jsonb_typeof(p_input->''aiConsent'') <> ''boolean'') or (select count(*) from jsonb_object_keys(p_input)) <> case when p_input ? ''aiConsent'' then 12 else 11 end';
BEGIN
  SELECT pg_get_functiondef('public.consultation_claim(jsonb,text,text)'::regprocedure) INTO old_def;
  IF position(old_check in old_def) = 0 THEN
    RAISE EXCEPTION 'CONSULTATION_CLAIM_SCHEMA_UNEXPECTED';
  END IF;
  new_def := replace(old_def, old_check, new_check);
  -- The existing hosted definition omits the final PL/pgSQL statement terminator.
  -- Repair its serialized form before recompiling; preserve the existing logic.
  new_def := replace(new_def, 'end$function
END
$migration$;
, 'end; $function
END
$migration$;
);
  EXECUTE new_def;
END
$migration$;

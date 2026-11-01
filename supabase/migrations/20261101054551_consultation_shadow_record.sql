-- Read one opted-in inquiry without relaxing RLS or exposing general table access.
-- The caller is the server-side service_role; the function returns no data for non-consented records.
CREATE OR REPLACE FUNCTION public.consultation_shadow_record(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', c.id, 'input', c.input, 'created_at', c.created_at, 'expires_at', c.expires_at
  )
  FROM public.consultation_requests AS c
  WHERE c.id = p_id
    AND c.expires_at > now()
    AND c.input->>'aiConsent' = 'true'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.consultation_shadow_record(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consultation_shadow_record(uuid) TO service_role;
COMMENT ON FUNCTION public.consultation_shadow_record(uuid)
IS 'Private consented shadow read for internal consultation processing. No anon or authenticated execute rights.';
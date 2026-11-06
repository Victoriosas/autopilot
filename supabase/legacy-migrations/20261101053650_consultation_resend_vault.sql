-- Vault secret value is provisioned separately and NEVER committed.
CREATE OR REPLACE FUNCTION public.consultation_resend_sender_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT d.decrypted_secret
  FROM vault.decrypted_secrets AS d
  WHERE d.name = 'victoriosas_consultation_resend_edge'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.consultation_resend_sender_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consultation_resend_sender_key() TO service_role;
COMMENT ON FUNCTION public.consultation_resend_sender_key() IS
  'Restricted server-only access to encrypted Resend sending key; only service_role can execute.';

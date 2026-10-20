-- Additive indexes for existing Beauty foreign keys. No records or policies change.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE INDEX IF NOT EXISTS beauty_evaluations_practitioner_id_idx
  ON public.beauty_evaluations (practitioner_id);
CREATE INDEX IF NOT EXISTS beauty_requests_catalog_service_id_idx
  ON public.beauty_requests (catalog_service_id);
COMMIT;

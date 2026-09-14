-- Durable Autopilot foreign-key indexes.
-- Additive and safe to apply after 20260914215143_durable_sourcing_orchestrator.
create index if not exists autopilot_product_drafts_sourcing_run_idx
  on public.autopilot_product_drafts(sourcing_run_id);

create index if not exists autopilot_sourcing_items_draft_idx
  on public.autopilot_sourcing_items(draft_id)
  where draft_id is not null;

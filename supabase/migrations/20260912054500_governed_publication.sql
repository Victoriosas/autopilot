alter table public.autopilot_product_drafts
  drop constraint if exists autopilot_product_drafts_status_check;

alter table public.autopilot_product_drafts
  add constraint autopilot_product_drafts_status_check
  check (status in ('draft', 'ai_approved', 'rejected', 'publishing', 'published'));

alter table public.autopilot_product_drafts
  add column if not exists published_product_id uuid,
  add column if not exists published_at timestamptz;

create unique index if not exists autopilot_product_drafts_published_product_uidx
  on public.autopilot_product_drafts (published_product_id)
  where published_product_id is not null;

create index if not exists autopilot_product_drafts_publication_status_idx
  on public.autopilot_product_drafts (status, updated_at desc);

comment on column public.autopilot_product_drafts.published_product_id is
  'Product created from this council-approved draft. Publication is server-side and does not trigger supplier purchase.';

comment on column public.autopilot_product_drafts.published_at is
  'Timestamp when a council-approved draft was published to the storefront catalog.';

alter table public.autopilot_product_drafts
  drop constraint if exists autopilot_product_drafts_status_check;

alter table public.autopilot_product_drafts
  add constraint autopilot_product_drafts_status_check
  check (status in ('draft', 'ai_approved', 'rejected'));

alter table public.autopilot_product_drafts
  add column if not exists reviewed_by text,
  add column if not exists review_reason text,
  add column if not exists reviewed_at timestamptz;

create index if not exists autopilot_product_drafts_status_idx
  on public.autopilot_product_drafts (status, created_at desc);

comment on column public.autopilot_product_drafts.reviewed_by is
  'Server-side review authority identifier. Standard approvals are recorded as AI council decisions and are never represented as human review.';

comment on column public.autopilot_product_drafts.review_reason is
  'Auditable rationale for approve/reject decisions, including council vote summaries when applicable.';

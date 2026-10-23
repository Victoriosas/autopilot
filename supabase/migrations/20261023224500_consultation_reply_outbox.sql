-- Private, one-shot reply delivery record. No client role grants.
create table if not exists public.consultation_reply_outbox (
  request_id uuid primary key references public.consultation_requests(id) on delete cascade,
  approved_by uuid not null,
  recipient text not null,
  subject text not null,
  body text not null,
  state text not null default 'sending' check (state in ('sending','sent','failed_unknown')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.consultation_reply_outbox enable row level security;
revoke all on public.consultation_reply_outbox from public, anon, authenticated;
comment on table public.consultation_reply_outbox is 'Private, approval-gated one-shot consultation replies. Unknown delivery states are not auto-retried.';
create index if not exists consultation_reply_outbox_created_at_idx on public.consultation_reply_outbox(created_at);

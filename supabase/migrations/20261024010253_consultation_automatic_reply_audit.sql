-- Automatic replies require durable uniqueness and explicit mode attribution.
-- No historic message is replayed and auto replies stay disabled until separately enabled.
begin;
alter table public.consultation_reply_outbox
  add column if not exists approval_mode text not null default 'human';
alter table public.consultation_reply_outbox
  alter column approved_by drop not null;
alter table public.consultation_reply_outbox
  drop constraint if exists consultation_reply_approval_mode_valid;
alter table public.consultation_reply_outbox
  add constraint consultation_reply_approval_mode_valid
  check (approval_mode in ('human','automatic') and
    ((approval_mode='human' and approved_by is not null) or
     (approval_mode='automatic' and approved_by is null)));
commit;

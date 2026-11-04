create table if not exists public.storefront_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  interest text not null default 'general' check (interest in ('general','facial_accessories','makeup_organization','reusable_care','body_care')),
  source text not null default 'storefront',
  consent_launch_updates boolean not null default false check (consent_launch_updates = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists storefront_waitlist_email_uidx on public.storefront_waitlist (lower(email));
create index if not exists storefront_waitlist_interest_created_idx on public.storefront_waitlist (interest, created_at desc);

alter table public.storefront_waitlist enable row level security;
revoke all on table public.storefront_waitlist from anon, authenticated;
grant select, insert, update on table public.storefront_waitlist to service_role;

comment on table public.storefront_waitlist is 'Explicit-consent launch notification list. Public clients cannot query or write this table directly.';
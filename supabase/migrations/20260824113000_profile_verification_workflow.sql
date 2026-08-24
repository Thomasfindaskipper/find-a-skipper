-- Profile verification workflow with private document storage.

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'admin'
  );
$$;

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  doc_type text not null check (doc_type in ('identity', 'license', 'certificate', 'company', 'ownership', 'mandate', 'other')),
  storage_path text not null unique,
  original_filename text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists verification_documents_request_id_idx
  on public.verification_documents(request_id);

create index if not exists verification_documents_user_id_idx
  on public.verification_documents(user_id);

alter table public.verification_requests enable row level security;
alter table public.verification_documents enable row level security;

drop policy if exists "Users read own verification request" on public.verification_requests;
create policy "Users read own verification request"
  on public.verification_requests for select
  using (auth.uid() = user_id);

drop policy if exists "Users manage own verification request" on public.verification_requests;
create policy "Users manage own verification request"
  on public.verification_requests for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own draft verification request" on public.verification_requests;
create policy "Users update own draft verification request"
  on public.verification_requests for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      status in ('draft', 'submitted')
      or status = (select vr.status from public.verification_requests vr where vr.id = verification_requests.id)
    )
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy if exists "Admins read all verification requests" on public.verification_requests;
create policy "Admins read all verification requests"
  on public.verification_requests for select
  using (public.is_admin(auth.uid()));

drop policy if exists "Admins update verification requests" on public.verification_requests;
create policy "Admins update verification requests"
  on public.verification_requests for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "Users read own verification documents" on public.verification_documents;
create policy "Users read own verification documents"
  on public.verification_documents for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own verification documents" on public.verification_documents;
create policy "Users insert own verification documents"
  on public.verification_documents for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own verification documents" on public.verification_documents;
create policy "Users delete own verification documents"
  on public.verification_documents for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins read all verification documents" on public.verification_documents;
create policy "Admins read all verification documents"
  on public.verification_documents for select
  using (public.is_admin(auth.uid()));

drop policy if exists "Admins delete verification documents" on public.verification_documents;
create policy "Admins delete verification documents"
  on public.verification_documents for delete
  using (public.is_admin(auth.uid()));

create or replace function public.touch_verification_request_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_verification_request_updated_at on public.verification_requests;
create trigger on_verification_request_updated_at
  before update on public.verification_requests
  for each row execute function public.touch_verification_request_updated_at();

create or replace function public.sync_profile_identity_from_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'approved' then
      update public.profiles
      set identity_verified = true
      where id = new.user_id;
    elsif new.status = 'rejected' then
      update public.profiles
      set identity_verified = false
      where id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_verification_request_status_change on public.verification_requests;
create trigger on_verification_request_status_change
  after update on public.verification_requests
  for each row execute function public.sync_profile_identity_from_verification();

insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Users upload own verification documents" on storage.objects;
create policy "Users upload own verification documents"
  on storage.objects for insert
  with check (
    bucket_id = 'verification-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users read own verification documents" on storage.objects;
create policy "Users read own verification documents"
  on storage.objects for select
  using (
    bucket_id = 'verification-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Users delete own verification documents" on storage.objects;
create policy "Users delete own verification documents"
  on storage.objects for delete
  using (
    bucket_id = 'verification-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin(auth.uid())
    )
  );

-- Harden profiles RLS by removing permissive duplicates and enforcing strict checks.
-- Scope: public.profiles policies only.

-- Remove permissive duplicate policies.
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- Recreate strict user insert policy.
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (
    auth.uid() = id
    and role in ('skipper', 'owner', 'broker', 'charter_company')
    and not coalesce(identity_verified, false)
  );

-- Recreate strict user update policy with explicit role and identity locks.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and identity_verified = (
      select p.identity_verified
      from public.profiles p
      where p.id = auth.uid()
    )
  );

-- Ensure admin read policy exists.
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Ensure admin update policy is explicit in both USING and WITH CHECK.
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

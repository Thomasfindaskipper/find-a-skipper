-- Harden missions RLS policies only.
-- Scope intentionally limited to public.missions policies.

-- Remove legacy or permissive mission policies.
drop policy if exists "Published missions are public; owners and admins can read all" on public.missions;
drop policy if exists "Anyone can read missions" on public.missions;

drop policy if exists "Owners or brokers can create mission" on public.missions;
drop policy if exists "Demandeurs can create their own missions" on public.missions;

drop policy if exists "Poster can update own missions" on public.missions;
drop policy if exists "Posters can update their own missions" on public.missions;

drop policy if exists "Admins can update any mission" on public.missions;

-- Keep mission visibility public for marketplace browsing.
create policy "Anyone can read missions"
  on public.missions for select
  using (true);

-- Only demandeur roles can create their own mission, always in open status.
create policy "Demandeurs can create their own missions"
  on public.missions for insert
  with check (
    auth.uid() = poster_id
    and status = 'open'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'broker', 'charter_company')
    )
  );

-- Mission owners can update their own mission while protected fields stay server-controlled.
create policy "Posters can update their own missions"
  on public.missions for update
  using (auth.uid() = poster_id)
  with check (
    auth.uid() = poster_id
    and is_featured = (
      select m.is_featured
      from public.missions m
      where m.id = missions.id
    )
    and applicants_count = (
      select m.applicants_count
      from public.missions m
      where m.id = missions.id
    )
  );

-- Admins can update any mission.
create policy "Admins can update any mission"
  on public.missions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

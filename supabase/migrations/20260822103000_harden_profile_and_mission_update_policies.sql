-- P0 security hardening: prevent privilege escalation in profiles update
-- and lock sensitive mission fields for non-admin mission posters.

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

drop policy if exists "Posters can update their own missions" on public.missions;
drop policy if exists "Poster can update own missions" on public.missions;
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

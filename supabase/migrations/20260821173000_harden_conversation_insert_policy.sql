-- Tighten conversation creation to mission owners contacting applicants only.
drop policy if exists "Demandeur can start a conversation" on public.conversations;

create policy "Demandeur can start a conversation"
  on public.conversations for insert
  with check (
    auth.uid() = demandeur_id
    and exists (
      select 1
      from public.missions m
      where m.id = mission_id
        and m.poster_id = auth.uid()
    )
    and exists (
      select 1
      from public.applications a
      where a.mission_id = mission_id
        and a.skipper_id = skipper_id
    )
  );

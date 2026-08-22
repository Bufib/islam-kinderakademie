-- Sobald eine Zeitgruppenzuordnung erstmals freigeschaltet wird, erhält das
-- zugehörige Elternprofil automatisch eine persönliche Mitteilung.

create or replace function public.notify_parent_on_time_group_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_profile_id bigint;
  child_display_name text;
  time_group_name text;
  time_group_schedule text;
begin
  if new.membership_status <> 'approved' then
    return null;
  end if;

  -- Erneutes Speichern einer bereits freigeschalteten Zuordnung erzeugt keine
  -- doppelte Mitteilung.
  if tg_op = 'UPDATE' and old.membership_status = 'approved' then
    return null;
  end if;

  select
    child.parent_profile_id,
    child.display_name,
    time_group.name,
    time_group.schedule_label
  into
    parent_profile_id,
    child_display_name,
    time_group_name,
    time_group_schedule
  from public.children as child
  join public.groups as time_group on time_group.id = new.group_id
  where child.id = new.child_id;

  if parent_profile_id is null then
    raise exception 'Parent profile for approved child not found';
  end if;

  insert into public.messages (
    sender_profile_id,
    recipient_profile_id,
    group_id,
    audience,
    subject,
    body,
    published_at
  )
  values (
    new.reviewed_by_profile_id,
    parent_profile_id,
    null,
    'profile',
    'Zeitgruppe freigeschaltet',
    'Die Zeitgruppe „' || time_group_name || '“ (' || time_group_schedule ||
      ') wurde für ' || child_display_name ||
      ' freigeschaltet. Ab sofort sind die zugehörigen Lektionen, Quizze, Termine und Zeitgruppenbereiche verfügbar.',
    now()::timestamp without time zone
  );

  return null;
end;
$$;

drop trigger if exists notify_parent_on_time_group_approval_after_write
on public.group_members;

create trigger notify_parent_on_time_group_approval_after_write
after insert or update of membership_status on public.group_members
for each row execute function public.notify_parent_on_time_group_approval();

revoke all on function public.notify_parent_on_time_group_approval() from public;

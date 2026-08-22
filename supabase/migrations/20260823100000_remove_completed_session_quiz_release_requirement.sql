-- Admins dürfen ein Quiz freigeben, sobald die zugehörige veröffentlichte
-- Lektion freigegeben ist. Der Status von Live-Terminen ist keine Voraussetzung.

create or replace function public.guard_quiz_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  related_lesson_released boolean;
  related_lesson_status text;
begin
  select lesson.is_released, lesson.status
  into related_lesson_released, related_lesson_status
  from public.lessons as lesson
  where lesson.id = new.lesson_id;

  if tg_op = 'INSERT' then
    if new.is_published then
      if not public.has_account_role('admin') then
        raise exception 'Admin role required';
      end if;

      if not coalesce(related_lesson_released, false)
        or related_lesson_status <> 'published' then
        raise exception 'Lesson must be released before quiz';
      end if;

      new.released_at := now()::timestamp without time zone;
      new.released_by_profile_id := public.current_profile_id();
    else
      new.released_at := null;
      new.released_by_profile_id := null;
    end if;

    return new;
  end if;

  if new.is_published is distinct from old.is_published then
    -- Beim Sperren einer Lektion darf das System auch das Quiz automatisch sperren.
    if new.is_published or coalesce(related_lesson_released, false) then
      if not public.has_account_role('admin') then
        raise exception 'Admin role required';
      end if;
    end if;

    if new.is_published then
      if not coalesce(related_lesson_released, false)
        or related_lesson_status <> 'published' then
        raise exception 'Lesson must be released before quiz';
      end if;

      new.released_at := now()::timestamp without time zone;
      new.released_by_profile_id := public.current_profile_id();
    else
      new.released_at := null;
      new.released_by_profile_id := null;
    end if;
  else
    new.released_at := old.released_at;
    new.released_by_profile_id := old.released_by_profile_id;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_quiz_release() from public;

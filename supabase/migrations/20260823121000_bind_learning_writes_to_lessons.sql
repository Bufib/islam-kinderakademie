-- Schreibzugriffe auf Lernfortschritt und Quizversuche werden an die konkrete
-- Lektion gebunden. Eine Freigabe fuer irgendeine Zeitgruppe reicht damit
-- nicht mehr aus, um Inhalte eines anderen Jahrgangs zu veraendern.

create or replace function public.can_child_access_lesson(
  target_child_id bigint,
  target_lesson_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.children as child
    join public.lessons as lesson
      on lesson.id = target_lesson_id
    join public.learning_journeys as journey
      on journey.id = lesson.learning_journey_id
    join public.academy_years as academy_year
      on academy_year.id = journey.academy_year_id
    where child.id = target_child_id
      and (
        public.is_academy_staff()
        or (
          child.parent_profile_id = public.current_profile_id()
          and lesson.status = 'published'
          and lesson.is_released
          and journey.is_published
          and academy_year.is_active
          and journey.age_group_id = child.age_group_id
          and exists (
            select 1
            from public.group_members as membership
            join public.groups as time_group
              on time_group.id = membership.group_id
            where membership.child_id = child.id
              and membership.membership_status = 'approved'
              and time_group.age_group_id = child.age_group_id
              and time_group.academy_year_id = journey.academy_year_id
          )
        )
      )
  )
$$;

create or replace function public.can_child_access_lesson_step(
  target_child_id bigint,
  target_lesson_step_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lesson_steps as lesson_step
    where lesson_step.id = target_lesson_step_id
      and public.can_child_access_lesson(
        target_child_id,
        lesson_step.lesson_id
      )
  )
$$;

create or replace function public.can_child_access_submission(
  target_child_id bigint,
  target_lesson_id bigint,
  target_lesson_step_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_child_access_lesson(target_child_id, target_lesson_id)
    and (
      target_lesson_step_id is null
      or exists (
        select 1
        from public.lesson_steps as lesson_step
        where lesson_step.id = target_lesson_step_id
          and lesson_step.lesson_id = target_lesson_id
      )
    )
$$;

create or replace function public.can_child_access_quiz(
  target_child_id bigint,
  target_quiz_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lesson_quizzes as quiz
    join public.lessons as lesson
      on lesson.id = quiz.lesson_id
    join public.learning_journeys as journey
      on journey.id = lesson.learning_journey_id
    join public.academy_years as academy_year
      on academy_year.id = journey.academy_year_id
    where quiz.id = target_quiz_id
      and quiz.is_published
      and lesson.status = 'published'
      and journey.is_published
      and academy_year.is_active
      and public.can_child_access_lesson(target_child_id, lesson.id)
  )
$$;

revoke all on function public.can_child_access_lesson(bigint, bigint)
from public;
revoke all on function public.can_child_access_lesson_step(bigint, bigint)
from public;
revoke all on function public.can_child_access_submission(bigint, bigint, bigint)
from public;
revoke all on function public.can_child_access_quiz(bigint, bigint)
from public;

grant execute on function public.can_child_access_lesson(bigint, bigint)
to authenticated;
grant execute on function public.can_child_access_lesson_step(bigint, bigint)
to authenticated;
grant execute on function public.can_child_access_submission(bigint, bigint, bigint)
to authenticated;
grant execute on function public.can_child_access_quiz(bigint, bigint)
to authenticated;

-- RLS prueft bei jeder Mutation sowohl das Kind als auch das konkrete Ziel.
drop policy if exists "Families and staff can insert lesson progress"
on public.child_lesson_progress;
drop policy if exists "Families and staff can update lesson progress"
on public.child_lesson_progress;
drop policy if exists "Families and staff can delete lesson progress"
on public.child_lesson_progress;

create policy "Families and staff can insert lesson progress"
on public.child_lesson_progress
for insert
to authenticated
with check (public.can_child_access_lesson(child_id, lesson_id));

create policy "Families and staff can update lesson progress"
on public.child_lesson_progress
for update
to authenticated
using (public.can_child_access_lesson(child_id, lesson_id))
with check (public.can_child_access_lesson(child_id, lesson_id));

create policy "Families and staff can delete lesson progress"
on public.child_lesson_progress
for delete
to authenticated
using (public.can_child_access_lesson(child_id, lesson_id));

drop policy if exists "Families and staff can insert step progress"
on public.child_step_progress;
drop policy if exists "Families and staff can update step progress"
on public.child_step_progress;
drop policy if exists "Families and staff can delete step progress"
on public.child_step_progress;

create policy "Families and staff can insert step progress"
on public.child_step_progress
for insert
to authenticated
with check (
  public.can_child_access_lesson_step(child_id, lesson_step_id)
);

create policy "Families and staff can update step progress"
on public.child_step_progress
for update
to authenticated
using (public.can_child_access_lesson_step(child_id, lesson_step_id))
with check (
  public.can_child_access_lesson_step(child_id, lesson_step_id)
);

create policy "Families and staff can delete step progress"
on public.child_step_progress
for delete
to authenticated
using (public.can_child_access_lesson_step(child_id, lesson_step_id));

drop policy if exists "Families and staff can insert submissions"
on public.submissions;
drop policy if exists "Families and staff can update submissions"
on public.submissions;
drop policy if exists "Families and staff can delete submissions"
on public.submissions;

create policy "Families and staff can insert submissions"
on public.submissions
for insert
to authenticated
with check (
  public.can_child_access_submission(child_id, lesson_id, lesson_step_id)
);

create policy "Families and staff can update submissions"
on public.submissions
for update
to authenticated
using (
  public.can_child_access_submission(child_id, lesson_id, lesson_step_id)
)
with check (
  public.can_child_access_submission(child_id, lesson_id, lesson_step_id)
);

create policy "Families and staff can delete submissions"
on public.submissions
for delete
to authenticated
using (
  public.can_child_access_submission(child_id, lesson_id, lesson_step_id)
);

-- SECURITY DEFINER-RPCs umgehen RLS. Zielbezogene Trigger erzwingen dieselben
-- Regeln deshalb auch fuer interne beziehungsweise spaetere Schreibpfade.
drop trigger if exists enforce_quiz_attempt_content_access
on public.quiz_attempts;
drop trigger if exists enforce_lesson_progress_content_access
on public.child_lesson_progress;
drop trigger if exists enforce_step_progress_content_access
on public.child_step_progress;
drop trigger if exists enforce_submission_content_access
on public.submissions;

drop function if exists public.enforce_child_learning_content_access();

create or replace function public.enforce_quiz_attempt_lesson_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_child_access_quiz(new.child_id, new.quiz_id) then
    raise exception 'Child cannot access this quiz'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_lesson_progress_lesson_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_child_access_lesson(new.child_id, new.lesson_id) then
    raise exception 'Child cannot access this lesson'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_step_progress_lesson_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_child_access_lesson_step(
    new.child_id,
    new.lesson_step_id
  ) then
    raise exception 'Child cannot access this lesson step'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_submission_lesson_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_child_access_submission(
    new.child_id,
    new.lesson_id,
    new.lesson_step_id
  ) then
    raise exception 'Child cannot access this submission target'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger enforce_quiz_attempt_lesson_access
before insert or update on public.quiz_attempts
for each row execute procedure public.enforce_quiz_attempt_lesson_access();

create trigger enforce_lesson_progress_lesson_access
before insert or update on public.child_lesson_progress
for each row execute procedure public.enforce_lesson_progress_lesson_access();

create trigger enforce_step_progress_lesson_access
before insert or update on public.child_step_progress
for each row execute procedure public.enforce_step_progress_lesson_access();

create trigger enforce_submission_lesson_access
before insert or update on public.submissions
for each row execute procedure public.enforce_submission_lesson_access();

revoke all on function public.enforce_quiz_attempt_lesson_access()
from public;
revoke all on function public.enforce_lesson_progress_lesson_access()
from public;
revoke all on function public.enforce_step_progress_lesson_access()
from public;
revoke all on function public.enforce_submission_lesson_access()
from public;

-- Die serverseitige Auswertung akzeptiert nur das eigene, exakt fuer diese
-- Lektion freigeschaltete Kind. Antwortschluessel bleiben serverseitig.
create or replace function public.submit_multiple_choice_quiz(
  target_child_id bigint,
  target_quiz_id bigint,
  submitted_answers jsonb
)
returns table (
  attempt_id bigint,
  correct_answers integer,
  total_questions integer,
  score_percent integer,
  passed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  quiz_lesson_id bigint;
  required_percent integer;
  created_attempt_id bigint;
  question_count integer;
  valid_answer_count integer;
  correct_count integer;
  calculated_percent integer;
  did_pass boolean;
begin
  if not public.can_child_access_quiz(target_child_id, target_quiz_id) then
    raise exception 'Child cannot access this quiz'
      using errcode = '42501';
  end if;

  select quiz.lesson_id, quiz.passing_percent
  into quiz_lesson_id, required_percent
  from public.lesson_quizzes as quiz
  where quiz.id = target_quiz_id;

  if quiz_lesson_id is null then
    raise exception 'Published quiz not found';
  end if;

  if coalesce(jsonb_typeof(submitted_answers), 'null') <> 'array' then
    raise exception 'Quiz answers must be an array';
  end if;

  select count(*)
  into question_count
  from public.quiz_questions
  where quiz_id = target_quiz_id;

  if question_count = 0 then
    raise exception 'Quiz has no questions';
  end if;

  select count(*)
  into valid_answer_count
  from (
    select distinct answer.question_id
    from jsonb_to_recordset(submitted_answers)
      as answer(question_id bigint, option_id bigint)
    join public.quiz_questions as question
      on question.id = answer.question_id
      and question.quiz_id = target_quiz_id
    join public.quiz_options as quiz_option
      on quiz_option.id = answer.option_id
      and quiz_option.question_id = question.id
  ) as valid_answers;

  if valid_answer_count <> question_count
    or jsonb_array_length(submitted_answers) <> question_count then
    raise exception 'Every quiz question must have one valid answer';
  end if;

  insert into public.quiz_attempts (
    child_id,
    quiz_id,
    correct_answers,
    total_questions,
    score_percent,
    passed
  )
  values (target_child_id, target_quiz_id, 0, question_count, 0, false)
  returning id into created_attempt_id;

  insert into public.quiz_attempt_answers (
    attempt_id,
    question_id,
    selected_option_id,
    is_correct
  )
  select
    created_attempt_id,
    answer.question_id,
    answer.option_id,
    answer.option_id = answer_key.correct_option_id
  from jsonb_to_recordset(submitted_answers)
    as answer(question_id bigint, option_id bigint)
  join public.quiz_questions as question
    on question.id = answer.question_id
    and question.quiz_id = target_quiz_id
  join public.quiz_options as quiz_option
    on quiz_option.id = answer.option_id
    and quiz_option.question_id = question.id
  join public.quiz_answer_keys as answer_key
    on answer_key.question_id = question.id;

  select count(*) filter (where answer.is_correct)
  into correct_count
  from public.quiz_attempt_answers as answer
  where answer.attempt_id = created_attempt_id;

  calculated_percent := round(
    (correct_count::numeric / question_count::numeric) * 100
  )::integer;
  did_pass := calculated_percent >= required_percent;

  update public.quiz_attempts
  set correct_answers = correct_count,
      score_percent = calculated_percent,
      passed = did_pass
  where id = created_attempt_id;

  insert into public.child_lesson_progress as progress (
    child_id,
    lesson_id,
    status,
    progress_percent,
    last_opened_at,
    completed_at
  )
  values (
    target_child_id,
    quiz_lesson_id,
    case when did_pass then 'completed' else 'in_progress' end,
    calculated_percent,
    now()::timestamp without time zone,
    case
      when did_pass then now()::timestamp without time zone
      else null
    end
  )
  on conflict (child_id, lesson_id) do update
  set status = case
        when progress.status = 'completed'
          or excluded.status = 'completed' then 'completed'
        else 'in_progress'
      end,
      progress_percent = greatest(
        progress.progress_percent,
        excluded.progress_percent
      ),
      last_opened_at = excluded.last_opened_at,
      completed_at = coalesce(
        progress.completed_at,
        excluded.completed_at
      );

  return query
  select
    created_attempt_id,
    correct_count,
    question_count,
    calculated_percent,
    did_pass;
end;
$$;

revoke all on function public.submit_multiple_choice_quiz(bigint, bigint, jsonb)
from public;

grant execute on function public.submit_multiple_choice_quiz(bigint, bigint, jsonb)
to authenticated;

comment on function public.can_child_access_lesson(bigint, bigint) is
  'Checks ownership, publication and an approved matching time group for one concrete lesson.';
comment on function public.can_child_access_quiz(bigint, bigint) is
  'Checks whether a child may submit one concrete published quiz.';

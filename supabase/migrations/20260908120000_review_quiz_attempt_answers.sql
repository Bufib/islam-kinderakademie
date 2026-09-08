-- Familien duerfen den Antwortschluessel nicht vor der Quizabgabe lesen.
-- Nach einem eigenen gespeicherten Versuch gibt diese Funktion die korrekte
-- Option jeder beantworteten Frage fuer die Auswertungsansicht frei.
create or replace function public.review_multiple_choice_quiz_attempt(
  target_attempt_id bigint
)
returns table (
  question_id bigint,
  selected_option_id bigint,
  is_correct boolean,
  correct_option_id bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.id = target_attempt_id
      and (
        public.owns_child(attempt.child_id)
        or public.is_academy_staff()
      )
  ) then
    raise exception 'Quiz attempt cannot be reviewed'
      using errcode = '42501';
  end if;

  return query
  select
    answer.question_id,
    answer.selected_option_id,
    answer.is_correct,
    answer_key.correct_option_id
  from public.quiz_attempt_answers as answer
  join public.quiz_questions as question
    on question.id = answer.question_id
  join public.quiz_answer_keys as answer_key
    on answer_key.question_id = answer.question_id
  where answer.attempt_id = target_attempt_id
  order by question.position, question.id;
end;
$$;

revoke all on function public.review_multiple_choice_quiz_attempt(bigint)
from public;

grant execute on function public.review_multiple_choice_quiz_attempt(bigint)
to authenticated;

comment on function public.review_multiple_choice_quiz_attempt(bigint) is
  'Returns selected and correct options only after an authorized stored quiz attempt.';

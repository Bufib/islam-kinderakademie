-- Neue und geänderte Kinderprofile benötigen ein Geburtsdatum. Der Constraint
-- wird NOT VALID angelegt, damit historische Profile ohne erfundenes Datum
-- erhalten bleiben und beim nächsten Bearbeiten vervollständigt werden können.

alter table public.children
drop constraint if exists children_birth_date_required_check;

alter table public.children
add constraint children_birth_date_required_check
check (birth_date is not null) not valid;

comment on column public.children.birth_date is
  'Verpflichtendes Geburtsdatum des Kindes. Historische Profile ohne Datum müssen beim nächsten Bearbeiten vervollständigt werden.';

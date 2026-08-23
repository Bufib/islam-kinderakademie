-- Account-Loeschungen muessen trotz aufbewahrungspflichtiger Zahlungsdaten
-- funktionieren. Die Vereinbarung bleibt als Buchungshistorie bestehen, wird
-- aber vor dem Loeschen des Auth-Nutzers getrennt, anonymisiert und beendet.
-- Gleichzeitig darf die Akademie nie ohne Administrationskonto bleiben.

create or replace function public.prepare_auth_user_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleting_profile_id bigint;
  admin_profile_count bigint;
begin
  select profile.id
  into deleting_profile_id
  from public.profiles as profile
  where profile.auth_user_id = old.id;

  if deleting_profile_id is not null
    and exists (
      select 1
      from public.user_roles as account_role
      where account_role.profile_id = deleting_profile_id
        and account_role.role = 'admin'
    ) then
    select count(distinct account_role.profile_id)
    into admin_profile_count
    from public.user_roles as account_role
    where account_role.role = 'admin';

    if admin_profile_count <= 1 then
      raise exception 'The last admin account cannot be deleted'
        using errcode = '42501';
    end if;
  end if;

  update public.payment_agreements
  set auth_user_id = null,
      payer_name = null,
      agreement_status = 'cancelled',
      updated_at = now()
  where auth_user_id = old.id;

  return old;
end;
$$;

drop trigger if exists prepare_auth_user_deletion_before_delete
on auth.users;

create trigger prepare_auth_user_deletion_before_delete
before delete on auth.users
for each row execute procedure public.prepare_auth_user_deletion();

revoke all on function public.prepare_auth_user_deletion()
from public;

comment on function public.prepare_auth_user_deletion() is
  'Protects the last admin and anonymizes retained payment history before an Auth account is deleted.';

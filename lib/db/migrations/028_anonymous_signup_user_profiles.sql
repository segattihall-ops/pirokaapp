-- Anonymous sign-ins failed with "Database error saving new user".
--
-- This Supabase project is shared with the business-os app, whose `on_auth_user_created`
-- trigger copies every new auth user into public.user_profiles(id, email). That table's
-- email column is NOT NULL, and anonymous users have no email, so the insert aborted the
-- whole auth.users transaction and Supabase returned a 500 to the sign-up call.
--
-- Skip the business-os profile row for users without an email. Users with an email
-- (Google, Apple, magic link, password) are handled exactly as before.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Add locale column to profiles table
alter table public.profiles
  add column if not exists locale text not null default 'en';

-- Constrain locale to supported values
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_locale_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_locale_check
      check (locale in ('en', 'it'));
  end if;
end
$$;

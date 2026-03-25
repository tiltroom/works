alter table public.profiles
  add column if not exists custom_hourly_rate_cents integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_custom_hourly_rate_positive'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_custom_hourly_rate_positive
      check (custom_hourly_rate_cents is null or custom_hourly_rate_cents > 0);
  end if;
end
$$;

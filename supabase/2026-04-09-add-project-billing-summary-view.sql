create or replace view public.project_billing_summary as
select
  p.id as project_id,
  p.name,
  p.customer_id,
  p.assigned_hours,
  p.billing_mode,
  coalesce(dl.outstanding_debt_hours, 0) as outstanding_debt_hours
from public.projects p
left join (
  select project_id, sum(hours)::numeric(10,2) as outstanding_debt_hours
  from public.project_debt_ledger
  group by project_id
) dl on dl.project_id = p.id;

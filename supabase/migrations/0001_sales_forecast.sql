-- Sales Forecast for Claude Code: schema.
-- Plain Postgres. Runs on any Postgres 13+ and on PGlite. Money is stored in cents (bigint).

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Settings the forecast rules read. One row per key.
create table settings (
  key text primary key,
  value text not null,
  note text not null default '',
  updated_at timestamptz not null default now()
);

-- Sales stages, in order, with the default probability. Closed stages end the deal.
create table stages (
  name text primary key,
  sort int not null,
  probability int not null check (probability between 0 and 100),
  is_closed boolean not null default false,
  is_won boolean not null default false,
  check (not is_won or is_closed)
);

create table reps (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  manager text not null default '',
  team text not null default '',
  external_id text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  external_id text unique,
  industry text not null default '',
  region text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A forecast period (usually a quarter). guidance_cents is the revenue figure published
-- to the market or the board, if there is one.
create table periods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts date not null,
  ends date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  guidance_cents bigint check (guidance_cents is null or guidance_cents >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends >= starts)
);

create table quotas (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references periods(id),
  rep_id uuid not null references reps(id),
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, rep_id)
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  account_id uuid references accounts(id),
  owner_id uuid not null references reps(id),
  stage text not null references stages(name) on update cascade,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  close_date date not null,
  probability int check (probability between 0 and 100),
  forecast_category text not null check (forecast_category in ('pipeline', 'best_case', 'commit', 'closed', 'omitted')),
  next_step text not null default '',
  next_step_on date,
  last_activity_on date,
  contract_signed_on date,
  created_on date not null default current_date,
  closed_on date,
  lost_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opportunities_close_date on opportunities (close_date);
create index opportunities_owner on opportunities (owner_id);

-- Every change to the fields a forecast depends on, oldest first. Import and update-deal write it.
create table opportunity_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id),
  changed_on date not null,
  field text not null check (field in ('stage', 'amount', 'close_date', 'forecast_category', 'owner')),
  old_value text,
  new_value text,
  actor text not null default '',
  created_at timestamptz not null default now()
);
create index opportunity_history_opp on opportunity_history (opportunity_id, changed_on);

-- The pipeline as it stood on a date. The waterfall and accuracy reports compare against these.
create table snapshots (
  id uuid primary key default gen_random_uuid(),
  taken_on date not null,
  opportunity_id uuid not null references opportunities(id),
  owner_id uuid not null references reps(id),
  stage text not null,
  amount_cents bigint not null,
  currency text not null,
  close_date date not null,
  forecast_category text not null,
  created_at timestamptz not null default now(),
  unique (taken_on, opportunity_id)
);

-- A rep's (or a manager's) submitted number for the period. Append only: a new call is a new row.
create table forecast_calls (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references periods(id),
  rep_id uuid not null references reps(id),
  submitted_on date not null default current_date,
  commit_cents bigint not null check (commit_cents >= 0),
  best_case_cents bigint not null check (best_case_cents >= commit_cents),
  note text not null default '',
  actor text not null,
  created_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id),
  happened_on date not null default current_date,
  kind text not null default 'note',
  note text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create table followups (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id),
  note text not null,
  owner text not null,
  due date not null,
  resolved_at timestamptz,
  evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who changed what, for every write the CLI makes.
create table events (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  entity text not null,
  detail jsonb not null default '{}'::jsonb
);

create trigger reps_touch before update on reps for each row execute function touch_updated_at();
create trigger accounts_touch before update on accounts for each row execute function touch_updated_at();
create trigger periods_touch before update on periods for each row execute function touch_updated_at();
create trigger quotas_touch before update on quotas for each row execute function touch_updated_at();
create trigger opportunities_touch before update on opportunities for each row execute function touch_updated_at();
create trigger followups_touch before update on followups for each row execute function touch_updated_at();
create trigger settings_touch before update on settings for each row execute function touch_updated_at();

-- Forecast calls are a record of what was said. They are never edited or deleted.
create or replace function calls_are_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'Forecast calls are append only. Submit a new call instead.';
end $$;
create trigger forecast_calls_no_update before update or delete on forecast_calls for each row execute function calls_are_append_only();

insert into settings (key, value, note) values
  ('stale_days', '14', 'A deal with no activity for this many days is flagged as gone quiet.'),
  ('commit_min_probability', '50', 'Forecast policy: a Commit deal should sit at a stage with at least this probability.'),
  ('push_limit', '2', 'A deal pushed this many times or more is flagged as a repeat slipper.'),
  ('guidance_review_pct', '5', 'ASX Guidance Note 8: a variance at or under 5% of published guidance is presumed not material.'),
  ('guidance_material_pct', '10', 'ASX Guidance Note 8: a variance of 10% or more of published guidance is presumed material.');

insert into stages (name, sort, probability, is_closed, is_won) values
  ('Prospecting', 10, 10, false, false),
  ('Qualification', 20, 10, false, false),
  ('Needs Analysis', 30, 20, false, false),
  ('Value Proposition', 40, 50, false, false),
  ('Id. Decision Makers', 50, 60, false, false),
  ('Perception Analysis', 60, 70, false, false),
  ('Proposal/Price Quote', 70, 75, false, false),
  ('Negotiation/Review', 80, 90, false, false),
  ('Closed Won', 90, 100, true, true),
  ('Closed Lost', 100, 0, true, false);

-- ---------------------------------------------------------------- views

create or replace function setting_int(k text) returns int language sql stable as $$
  select value::int from settings where key = k
$$;

-- Every deal with its stage facts, owner and how many times its close date has been pushed out.
create view v_deals as
select o.id, o.external_id, o.name as deal, a.name as account, r.code as rep_code, r.name as rep, o.owner_id,
       o.stage, s.sort as stage_sort, coalesce(o.probability, s.probability) as probability,
       s.is_closed, s.is_won, o.amount_cents, o.currency, o.close_date, o.forecast_category,
       o.next_step, o.next_step_on, o.last_activity_on, o.contract_signed_on, o.created_on, o.closed_on,
       (select count(*)::int from opportunity_history h
         where h.opportunity_id = o.id and h.field = 'close_date' and h.new_value > h.old_value) as pushes,
       p.id as period_id, p.name as period
from opportunities o
join stages s on s.name = o.stage
join reps r on r.id = o.owner_id
left join accounts a on a.id = o.account_id
left join periods p on o.close_date between p.starts and p.ends;

-- The forecast roll-up per period and rep. Commit and best case include what is already won,
-- the way Salesforce rolls up its categories.
create view v_forecast as
with base as (
  select p.id as period_id, p.name as period, p.currency, p.status, r.id as rep_id, r.code as rep_code, r.name as rep,
         coalesce(q.amount_cents, 0) as quota_cents,
         coalesce(sum(d.amount_cents) filter (where d.is_won), 0)::bigint as won_cents,
         coalesce(sum(d.amount_cents) filter (where not d.is_closed and d.forecast_category = 'commit'), 0)::bigint as open_commit_cents,
         coalesce(sum(d.amount_cents) filter (where not d.is_closed and d.forecast_category = 'best_case'), 0)::bigint as open_best_case_cents,
         coalesce(sum(d.amount_cents) filter (where not d.is_closed and d.forecast_category <> 'omitted'), 0)::bigint as pipeline_cents,
         (count(d.id) filter (where not d.is_closed))::int as open_deals
  from periods p
  cross join reps r
  left join quotas q on q.period_id = p.id and q.rep_id = r.id
  left join v_deals d on d.period_id = p.id and d.owner_id = r.id and d.currency = p.currency
  where r.active or q.id is not null
  group by p.id, p.name, p.currency, p.status, r.id, r.code, r.name, q.amount_cents
), calls as (
  select distinct on (period_id, rep_id) period_id, rep_id, commit_cents, best_case_cents, submitted_on
  from forecast_calls order by period_id, rep_id, submitted_on desc, created_at desc
)
select b.period_id, b.period, b.currency, b.status, b.rep_id, b.rep_code, b.rep, b.quota_cents, b.won_cents,
       b.won_cents + b.open_commit_cents as commit_cents,
       b.won_cents + b.open_commit_cents + b.open_best_case_cents as best_case_cents,
       b.pipeline_cents, b.open_deals,
       c.commit_cents as call_commit_cents, c.best_case_cents as call_best_case_cents, c.submitted_on as call_on,
       c.commit_cents - (b.won_cents + b.open_commit_cents) as call_vs_system_cents,
       greatest(b.quota_cents - b.won_cents - b.open_commit_cents, 0) as gap_cents,
       case when b.quota_cents > b.won_cents then round(b.pipeline_cents::numeric / (b.quota_cents - b.won_cents), 2) end as coverage,
       case when b.quota_cents > 0 then round(100.0 * b.won_cents / b.quota_cents) end as attained_pct
from base b left join calls c on c.period_id = b.period_id and c.rep_id = b.rep_id;

-- One row per risk on an open deal. A deal can carry several.
create view v_deal_risk as
with d as (select * from v_deals where not is_closed and period_id is not null)
select id, deal, account, rep, period_id, period, stage, forecast_category, amount_cents, currency, close_date, 'close date passed' as risk,
       (current_date - close_date) || ' days ago' as detail from d where close_date < current_date
union all
select id, deal, account, rep, period_id, period, stage, forecast_category, amount_cents, currency, close_date, 'no next step', 'blank or undated'
from d where next_step = '' or next_step_on is null
union all
select id, deal, account, rep, period_id, period, stage, forecast_category, amount_cents, currency, close_date, 'next step overdue',
       next_step || ' (due ' || next_step_on || ')' from d where next_step <> '' and next_step_on < current_date
union all
select id, deal, account, rep, period_id, period, stage, forecast_category, amount_cents, currency, close_date, 'gone quiet',
       coalesce('last activity ' || (current_date - last_activity_on) || ' days ago', 'no activity logged')
from d where last_activity_on is null or last_activity_on < current_date - setting_int('stale_days')
union all
select id, deal, account, rep, period_id, period, stage, forecast_category, amount_cents, currency, close_date, 'repeat slipper',
       'close date pushed ' || pushes || ' times' from d where pushes >= setting_int('push_limit')
union all
select id, deal, account, rep, period_id, period, stage, forecast_category, amount_cents, currency, close_date, 'commit at an early stage',
       stage || ' (' || probability || '%)' from d where forecast_category = 'commit' and probability < setting_int('commit_min_probability');

-- What moved in each period's forecast since a snapshot date. Function so the CLI can pick the date.
create or replace function movement(p_period uuid, p_since date)
returns table (change text, deal text, rep text, from_category text, to_category text,
               from_amount_cents bigint, to_amount_cents bigint, delta_cents bigint, currency text, detail text)
language sql stable as $$
  with per as (select * from periods where id = p_period),
  base_date as (select max(taken_on) as d from snapshots where taken_on <= p_since),
  b as (
    select s.* from snapshots s, per, base_date
    where s.taken_on = base_date.d and s.close_date between per.starts and per.ends
      and s.forecast_category not in ('closed', 'omitted')
  ),
  c as (
    select d.* from v_deals d, per, base_date
    where d.period_id = per.id and (d.forecast_category <> 'omitted' or d.is_closed)
      and not (d.is_closed and coalesce(d.closed_on, d.close_date) <= base_date.d)
  ),
  joined as (
    select coalesce(c.deal, o.name) as deal, coalesce(c.rep, r.name) as rep,
           b.forecast_category as from_cat, c.forecast_category as to_cat,
           b.amount_cents as from_amt,
           case when c.is_closed and not c.is_won then 0 else c.amount_cents end as to_amt, coalesce(c.currency, b.currency) as currency,
           b.opportunity_id is not null as in_base, c.id is not null as in_now,
           c.is_won, c.is_closed, c.created_on, o.close_date as close_now, b.close_date as close_then,
           base_date.d as since
    from b
    full join c on c.id = b.opportunity_id
    left join opportunities o on o.id = coalesce(c.id, b.opportunity_id)
    left join reps r on r.id = o.owner_id
    cross join base_date
  )
  select change, deal, rep, from_cat, to_cat, from_amt, to_amt,
         coalesce(to_amt, 0) - coalesce(from_amt, 0), currency, detail
  from (
    select *,
      case
        when in_base and in_now and is_won then 'won'
        when in_base and in_now and is_closed then 'lost'
        when in_base and not in_now and close_now = close_then then 'removed'
        when in_base and not in_now then 'pushed out'
        when not in_base and in_now and is_closed and is_won then 'won (new to period)'
        when not in_base and in_now and is_closed then null
        when not in_base and in_now and created_on > since then 'new'
        when not in_base and in_now then 'pulled in'
        when to_amt > from_amt then 'increased'
        when to_amt < from_amt then 'decreased'
        when from_cat <> to_cat then 'recategorised'
      end as change,
      case
        when in_base and not in_now and close_now = close_then then 'moved to omitted'
        when in_base and not in_now then 'close date ' || close_then || ' to ' || close_now
        when from_cat is distinct from to_cat and in_base and in_now then from_cat || ' to ' || to_cat
        else ''
      end as detail
    from joined
  ) x
  where change is not null
  order by case change when 'won' then 1 when 'won (new to period)' then 2 when 'lost' then 3 when 'pushed out' then 4
                       when 'decreased' then 5 when 'recategorised' then 6 when 'pulled in' then 7 when 'new' then 8 else 9 end,
           abs(coalesce(to_amt, 0) - coalesce(from_amt, 0)) desc
$$;

create view v_movement as
select p.name as period, m.* from periods p, lateral movement(p.id, current_date - 7) m where p.status = 'open';

-- How close each rep's first and last call came to what they actually won, per closed period.
create view v_accuracy as
with calls as (
  select period_id, rep_id,
         (array_agg(commit_cents order by submitted_on, created_at))[1] as first_call_cents,
         (array_agg(submitted_on order by submitted_on, created_at))[1] as first_call_on,
         (array_agg(commit_cents order by submitted_on desc, created_at desc))[1] as last_call_cents,
         count(*) as calls
  from forecast_calls group by period_id, rep_id
)
select f.period_id, f.period, f.currency, f.rep, f.won_cents, c.first_call_cents, c.first_call_on, c.last_call_cents, c.calls,
       case when f.won_cents > 0 then round(100.0 * (c.first_call_cents - f.won_cents) / f.won_cents) end as first_call_error_pct,
       case when f.won_cents > 0 then round(100.0 * (c.last_call_cents - f.won_cents) / f.won_cents) end as last_call_error_pct
from v_forecast f join calls c on c.period_id = f.period_id and c.rep_id = f.rep_id
where f.status = 'closed';

-- The checks in docs/compliance.md. One row per finding.
create view v_compliance as
select 'IFRS 15 contract evidence' as rule, 'breach' as severity, d.deal as item,
       'Closed Won on ' || coalesce(d.closed_on::text, d.close_date::text) || ' with no signed contract date' as issue
from v_deals d where d.is_won and d.contract_signed_on is null
union all
select 'Published guidance variance',
       case when abs(t.variance_pct) >= setting_int('guidance_material_pct') then 'breach' else 'review' end,
       t.period,
       'Won plus commit ' || t.currency || ' ' || to_char(t.est_cents / 100.0, 'FM999,999,999,990') ||
       ' is ' || t.variance_pct || '% from guidance of ' || t.currency || ' ' || to_char(t.guidance_cents / 100.0, 'FM999,999,999,990')
from (
  select p.name as period, p.currency, p.guidance_cents, sum(f.commit_cents)::bigint as est_cents,
         round(100.0 * (sum(f.commit_cents) - p.guidance_cents) / nullif(p.guidance_cents, 0), 1) as variance_pct
  from periods p join v_forecast f on f.period_id = p.id
  where p.guidance_cents is not null and p.status = 'open'
  group by p.name, p.currency, p.guidance_cents
) t where abs(t.variance_pct) > setting_int('guidance_review_pct')
union all
select 'Forecast policy: commit stage', 'review', d.deal,
       'Commit at ' || d.stage || ' (' || d.probability || '%), policy minimum ' || setting_int('commit_min_probability') || '%'
from v_deals d where not d.is_closed and d.forecast_category = 'commit' and d.probability < setting_int('commit_min_probability')
union all
select 'Forecast policy: commit next step', 'review', d.deal, 'Commit with no dated next step'
from v_deals d where not d.is_closed and d.forecast_category = 'commit' and (d.next_step = '' or d.next_step_on is null)
union all
select 'Closed period changed', 'breach', o.name,
       h.field || ' changed on ' || h.changed_on || ' after ' || p.name || ' closed'
from opportunity_history h
join opportunities o on o.id = h.opportunity_id
join periods p on p.status = 'closed' and o.close_date between p.starts and p.ends
where h.changed_on > p.closed_at::date
union all
select 'Currency mismatch', 'review', d.deal, d.currency || ' deal in a ' || p.currency || ' period, left out of the roll-up'
from v_deals d join periods p on p.id = d.period_id where d.currency <> p.currency;

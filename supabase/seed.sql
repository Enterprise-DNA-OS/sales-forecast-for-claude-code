-- Demo data: a fictional New Zealand business-software seller with four reps.
-- Dates are relative to the day you seed, so the demo always has a live quarter,
-- a closed quarter to measure accuracy against, and deals that have gone quiet or slipped.
-- Running it twice does nothing.
do $$
declare
  t date := current_date;
  s date := current_date - 45;   -- FY27 Q2 starts
  e date := current_date + 45;   -- FY27 Q2 ends
  q1 uuid; q2 uuid; q3 uuid;
begin
  if exists (select 1 from reps where code = 'AN') then
    return;
  end if;

  insert into reps (code, name, manager, team, external_id) values
    ('AN', 'Aroha Ngata', 'Mere Walker', 'North', '005DEMO00000000AN'),
    ('BS', 'Ben Sutherland', 'Mere Walker', 'North', '005DEMO00000000BS'),
    ('CL', 'Chloe Liu', 'Mere Walker', 'South', '005DEMO00000000CL'),
    ('DP', 'Dev Patel', 'Mere Walker', 'South', '005DEMO00000000DP');

  insert into periods (name, starts, ends, currency, status, closed_at, closed_by)
    values ('FY27 Q1', s - 91, s - 1, 'NZD', 'closed', (s + 3)::timestamptz, 'Mere Walker') returning id into q1;
  insert into periods (name, starts, ends, currency, guidance_cents)
    values ('FY27 Q2', s, e, 'NZD', 80000000) returning id into q2;
  insert into periods (name, starts, ends, currency)
    values ('FY27 Q3', e + 1, e + 91, 'NZD') returning id into q3;

  insert into quotas (period_id, rep_id, amount_cents)
  select q1, id, case code when 'AN' then 30000000 when 'BS' then 25000000 when 'CL' then 28000000 else 26000000 end from reps
  union all
  select q2, id, case code when 'AN' then 32000000 when 'BS' then 28000000 when 'CL' then 30000000 else 25000000 end from reps;

  insert into accounts (name, industry, region) values
    ('Harbour Freight', 'Logistics', 'Auckland'), ('Tasman Foods', 'Food manufacturing', 'Nelson'),
    ('Coastal Councils Shared Services', 'Local government', 'Wellington'), ('Southern Dairy Co-op', 'Dairy', 'Southland'),
    ('Pacific Health Group', 'Healthcare', 'Auckland'), ('Wellington Legal Partners', 'Legal', 'Wellington'),
    ('Northland Timber', 'Forestry', 'Whangarei'), ('Canterbury Engineering', 'Engineering', 'Christchurch'),
    ('Auckland Retail Group', 'Retail', 'Auckland'), ('Otago Polytechnic Services', 'Education', 'Dunedin'),
    ('Bay Logistics', 'Logistics', 'Tauranga'), ('Hawkes Bay Orchards', 'Horticulture', 'Hastings'),
    ('Rotorua Tourism Board', 'Tourism', 'Rotorua'), ('Nelson Marine', 'Marine', 'Nelson'),
    ('Waikato Energy', 'Energy', 'Hamilton'), ('Taranaki Agri', 'Agriculture', 'New Plymouth'),
    ('Marlborough Wines', 'Wine', 'Blenheim'), ('Gisborne Port', 'Ports', 'Gisborne'),
    ('Westport Mining', 'Mining', 'Westport'), ('Kapiti Health', 'Healthcare', 'Paraparaumu'),
    ('Queenstown Resorts', 'Hospitality', 'Queenstown'), ('Palmerston North Grain', 'Agriculture', 'Manawatu');

  -- columns: external_id, deal, account, rep, stage, amount (dollars), category, close, next step, next step on,
  --          last activity, contract signed, created, closed on, lost reason
  insert into opportunities (external_id, name, account_id, owner_id, stage, amount_cents, currency, close_date,
                             forecast_category, next_step, next_step_on, last_activity_on, contract_signed_on,
                             created_on, closed_on, lost_reason)
  select v.ext, v.deal, a.id, r.id, v.stage, v.amount * 100, 'NZD', v.close_date, v.cat, v.next_step, v.next_on,
         v.activity, v.signed, v.created, v.closed, v.lost
  from (values
    -- FY27 Q2, open
    ('006DEMO0000000001', 'Fleet rollout, 140 vehicles', 'Harbour Freight', 'AN', 'Negotiation/Review', 85000, 'commit', t + 10, 'Legal redlines back', t + 3, t - 2, null::date, s - 40, null::date, ''),
    ('006DEMO0000000002', 'ERP expansion to three sites', 'Tasman Foods', 'AN', 'Proposal/Price Quote', 120000, 'commit', t - 5, '', null, t - 20, null, s - 60, null, ''),
    ('006DEMO0000000003', 'Shared rates platform', 'Coastal Councils Shared Services', 'BS', 'Value Proposition', 60000, 'best_case', t + 30, 'Requirements workshop', t + 8, t - 4, null, s - 20, null, ''),
    ('006DEMO0000000004', 'Supplier portal', 'Southern Dairy Co-op', 'BS', 'Needs Analysis', 95000, 'commit', t + 40, 'Discovery call with ops', t - 3, t - 9, null, s + 10, null, ''),
    ('006DEMO0000000005', 'Patient scheduling, 12 clinics', 'Pacific Health Group', 'CL', 'Negotiation/Review', 150000, 'commit', t + 20, 'Board approval', t + 12, t - 1, null, s - 70, null, ''),
    ('006DEMO0000000006', 'Matter reporting', 'Wellington Legal Partners', 'CL', 'Id. Decision Makers', 45000, 'best_case', t + 15, '', null, t - 16, null, s + 5, null, ''),
    ('006DEMO0000000007', 'Mill maintenance system', 'Northland Timber', 'DP', 'Proposal/Price Quote', 70000, 'commit', t + 25, 'Pricing sign-off', t + 5, t - 3, null, s - 10, null, ''),
    ('006DEMO0000000008', 'Workshop scheduling', 'Canterbury Engineering', 'DP', 'Prospecting', 40000, 'pipeline', t + 44, 'Intro meeting', t + 6, t - 2, null, t - 2, null, ''),
    ('006DEMO0000000009', 'Store replenishment pilot', 'Auckland Retail Group', 'AN', 'Qualification', 30000, 'pipeline', t + 35, 'Follow up after trade show', t - 10, t - 25, null, s + 15, null, ''),
    ('006DEMO0000000015', 'Network asset register', 'Waikato Energy', 'DP', 'Negotiation/Review', 110000, 'best_case', t + 30, 'Procurement panel', t + 9, t - 2, null, s - 30, null, ''),
    ('006DEMO0000000016', 'Grower payments module', 'Taranaki Agri', 'BS', 'Proposal/Price Quote', 38000, 'commit', t + 18, 'Final proposal walkthrough', t + 4, t - 1, null, s - 5, null, ''),
    -- FY27 Q2, closed
    ('006DEMO0000000011', 'Depot booking system', 'Bay Logistics', 'BS', 'Closed Won', 65000, 'closed', t - 12, '', null, t - 12, t - 13, s - 50, t - 12, ''),
    ('006DEMO0000000012', 'Packhouse labour tracking', 'Hawkes Bay Orchards', 'DP', 'Closed Won', 48000, 'closed', t - 2, '', null, t - 2, null, s - 25, t - 2, ''),
    ('006DEMO0000000013', 'Visitor insights', 'Rotorua Tourism Board', 'AN', 'Closed Lost', 35000, 'omitted', t - 5, '', null, t - 5, null, s - 15, t - 5, 'Stayed with the incumbent'),
    ('006DEMO0000000014', 'Vessel maintenance', 'Nelson Marine', 'CL', 'Closed Won', 40000, 'closed', t - 30, '', null, t - 30, t - 31, s - 45, t - 30, ''),
    -- FY27 Q3, open
    ('006DEMO0000000010', 'Campus services desk', 'Otago Polytechnic Services', 'CL', 'Value Proposition', 55000, 'best_case', e + 20, 'Budget round', e + 5, t - 6, null, s - 35, null, ''),
    ('006DEMO0000000017', 'Cellar door bookings', 'Marlborough Wines', 'CL', 'Qualification', 50000, 'pipeline', e + 30, 'Site visit', t + 14, t - 5, null, s + 20, null, ''),
    ('006DEMO0000000018', 'Berth planning', 'Gisborne Port', 'AN', 'Value Proposition', 90000, 'best_case', e + 40, 'Technical review', t + 21, t - 7, null, s + 2, null, ''),
    -- FY27 Q1, closed
    ('006DEMO0000000101', 'Ore haulage tracking', 'Westport Mining', 'DP', 'Closed Won', 120000, 'closed', s - 20, '', null, s - 20, s - 22, s - 150, s - 20, ''),
    ('006DEMO0000000102', 'Clinic rostering', 'Kapiti Health', 'DP', 'Closed Won', 80000, 'closed', s - 40, '', null, s - 40, s - 41, s - 120, s - 40, ''),
    ('006DEMO0000000103', 'Guest messaging', 'Queenstown Resorts', 'DP', 'Closed Lost', 75000, 'omitted', s - 10, '', null, s - 10, null, s - 130, s - 10, 'No budget this year'),
    ('006DEMO0000000104', 'Grain intake system', 'Palmerston North Grain', 'AN', 'Closed Won', 140000, 'closed', s - 15, '', null, s - 15, s - 16, s - 140, s - 15, ''),
    ('006DEMO0000000105', 'Freight visibility', 'Harbour Freight', 'AN', 'Closed Won', 90000, 'closed', s - 60, '', null, s - 60, s - 61, s - 160, s - 60, ''),
    ('006DEMO0000000106', 'Dock scheduling', 'Gisborne Port', 'AN', 'Closed Lost', 60000, 'omitted', s - 30, '', null, s - 30, null, s - 120, s - 30, 'Lost on price'),
    ('006DEMO0000000107', 'Fleet telematics reporting', 'Bay Logistics', 'BS', 'Closed Won', 180000, 'closed', s - 25, '', null, s - 25, s - 26, s - 140, s - 25, ''),
    ('006DEMO0000000108', 'Recipe costing', 'Tasman Foods', 'BS', 'Closed Lost', 40000, 'omitted', s - 50, '', null, s - 50, null, s - 120, s - 50, 'Project paused'),
    ('006DEMO0000000109', 'Theatre scheduling', 'Pacific Health Group', 'CL', 'Closed Won', 260000, 'closed', s - 5, '', null, s - 5, s - 6, s - 170, s - 5, '')
  ) as v(ext, deal, account, rep, stage, amount, cat, close_date, next_step, next_on, activity, signed, created, closed, lost)
  join accounts a on a.name = v.account
  join reps r on r.code = v.rep;

  -- What changed, and when. Pushes on Tasman Foods and Pacific Health, a pull-in, a downgrade, a push to Q3.
  insert into opportunity_history (opportunity_id, changed_on, field, old_value, new_value, actor)
  select o.id, v.changed_on, v.field, v.old_value, v.new_value, v.actor
  from (values
    ('006DEMO0000000002', s + 15, 'close_date', (s + 20)::text, (s + 30)::text, 'Aroha Ngata'),
    ('006DEMO0000000002', s + 28, 'close_date', (s + 30)::text, (t - 10)::text, 'Aroha Ngata'),
    ('006DEMO0000000002', t - 11, 'close_date', (t - 10)::text, (t - 5)::text, 'Aroha Ngata'),
    ('006DEMO0000000005', t - 20, 'close_date', (t + 10)::text, (t + 20)::text, 'Chloe Liu'),
    ('006DEMO0000000007', t - 3, 'amount', '55000', '70000', 'Dev Patel'),
    ('006DEMO0000000015', t - 2, 'forecast_category', 'commit', 'best_case', 'Dev Patel'),
    ('006DEMO0000000016', t - 1, 'close_date', (e + 10)::text, (t + 18)::text, 'Ben Sutherland'),
    ('006DEMO0000000010', t - 4, 'close_date', (t + 20)::text, (e + 20)::text, 'Chloe Liu'),
    ('006DEMO0000000012', t - 2, 'stage', 'Negotiation/Review', 'Closed Won', 'Dev Patel'),
    ('006DEMO0000000012', t - 2, 'close_date', (t + 5)::text, (t - 2)::text, 'Dev Patel'),
    ('006DEMO0000000013', t - 5, 'stage', 'Proposal/Price Quote', 'Closed Lost', 'Aroha Ngata'),
    -- changed after FY27 Q1 was closed
    ('006DEMO0000000101', t - 20, 'amount', '110000', '120000', 'Dev Patel')
  ) as v(ext, changed_on, field, old_value, new_value, actor)
  join opportunities o on o.external_id = v.ext;

  -- The pipeline as it stood at the start of the quarter and a week ago.
  insert into snapshots (taken_on, opportunity_id, owner_id, stage, amount_cents, currency, close_date, forecast_category)
  select v.taken_on, o.id, o.owner_id, v.stage, v.amount * 100, 'NZD', v.close_date, v.cat
  from (values
    (t - 7, '006DEMO0000000001', 'Negotiation/Review', 85000, t + 10, 'commit'),
    (t - 7, '006DEMO0000000002', 'Proposal/Price Quote', 120000, t - 5, 'commit'),
    (t - 7, '006DEMO0000000003', 'Value Proposition', 60000, t + 30, 'best_case'),
    (t - 7, '006DEMO0000000004', 'Needs Analysis', 95000, t + 40, 'commit'),
    (t - 7, '006DEMO0000000005', 'Negotiation/Review', 150000, t + 20, 'commit'),
    (t - 7, '006DEMO0000000006', 'Id. Decision Makers', 45000, t + 15, 'best_case'),
    (t - 7, '006DEMO0000000007', 'Proposal/Price Quote', 55000, t + 25, 'commit'),
    (t - 7, '006DEMO0000000009', 'Qualification', 30000, t + 35, 'pipeline'),
    (t - 7, '006DEMO0000000010', 'Value Proposition', 55000, t + 20, 'best_case'),
    (t - 7, '006DEMO0000000012', 'Negotiation/Review', 48000, t + 5, 'commit'),
    (t - 7, '006DEMO0000000013', 'Proposal/Price Quote', 35000, t + 8, 'best_case'),
    (t - 7, '006DEMO0000000015', 'Negotiation/Review', 110000, t + 30, 'commit'),
    (t - 7, '006DEMO0000000016', 'Proposal/Price Quote', 38000, e + 10, 'commit'),
    (t - 7, '006DEMO0000000017', 'Qualification', 50000, e + 30, 'pipeline'),
    (t - 7, '006DEMO0000000018', 'Value Proposition', 90000, e + 40, 'best_case'),
    (s, '006DEMO0000000001', 'Proposal/Price Quote', 85000, t + 10, 'best_case'),
    (s, '006DEMO0000000002', 'Proposal/Price Quote', 120000, s + 20, 'commit'),
    (s, '006DEMO0000000005', 'Proposal/Price Quote', 150000, t + 10, 'commit'),
    (s, '006DEMO0000000007', 'Needs Analysis', 55000, t + 25, 'pipeline'),
    (s, '006DEMO0000000010', 'Needs Analysis', 55000, t + 20, 'pipeline'),
    (s, '006DEMO0000000011', 'Negotiation/Review', 65000, t - 12, 'commit'),
    (s, '006DEMO0000000012', 'Value Proposition', 48000, t + 5, 'best_case'),
    (s, '006DEMO0000000014', 'Negotiation/Review', 40000, t - 30, 'commit'),
    (s, '006DEMO0000000015', 'Proposal/Price Quote', 110000, t + 30, 'commit')
  ) as v(taken_on, ext, stage, amount, close_date, cat)
  join opportunities o on o.external_id = v.ext;

  -- What each rep called. Calls are append only.
  insert into forecast_calls (period_id, rep_id, submitted_on, commit_cents, best_case_cents, note, actor)
  select p.id, r.id, v.submitted_on, v.commit_amount * 100, v.best_amount * 100, v.note, r.name
  from (values
    ('FY27 Q1', 'AN', s - 84, 300000, 380000, 'Grain intake and dock scheduling both landing'),
    ('FY27 Q1', 'BS', s - 84, 200000, 240000, ''),
    ('FY27 Q1', 'CL', s - 84, 250000, 300000, ''),
    ('FY27 Q1', 'DP', s - 84, 280000, 360000, 'Guest messaging is a lock'),
    ('FY27 Q1', 'AN', s - 8, 240000, 260000, ''),
    ('FY27 Q1', 'BS', s - 8, 185000, 200000, ''),
    ('FY27 Q1', 'CL', s - 8, 255000, 270000, ''),
    ('FY27 Q1', 'DP', s - 8, 210000, 280000, ''),
    ('FY27 Q2', 'AN', s + 7, 260000, 340000, ''),
    ('FY27 Q2', 'BS', s + 7, 160000, 230000, ''),
    ('FY27 Q2', 'CL', s + 7, 200000, 280000, ''),
    ('FY27 Q2', 'DP', s + 7, 240000, 300000, ''),
    ('FY27 Q2', 'AN', t - 3, 250000, 330000, 'Tasman Foods signs this month'),
    ('FY27 Q2', 'BS', t - 3, 150000, 230000, ''),
    ('FY27 Q2', 'CL', t - 3, 200000, 300000, ''),
    ('FY27 Q2', 'DP', t - 3, 260000, 340000, 'Waikato Energy back in by month end')
  ) as v(period, rep, submitted_on, commit_amount, best_amount, note)
  join periods p on p.name = v.period
  join reps r on r.code = v.rep;

  insert into activities (opportunity_id, happened_on, kind, note, actor)
  select o.id, v.happened_on, v.kind, v.note, v.actor
  from (values
    ('006DEMO0000000001', t - 2, 'call', 'Procurement confirmed budget. Legal reviewing our terms.', 'Aroha Ngata'),
    ('006DEMO0000000002', t - 20, 'email', 'Sent revised pricing. No reply yet.', 'Aroha Ngata'),
    ('006DEMO0000000005', t - 1, 'meeting', 'CFO walked the board paper with us. Approval on the agenda.', 'Chloe Liu'),
    ('006DEMO0000000007', t - 3, 'call', 'Added the second mill. Amount up to 70k.', 'Dev Patel'),
    ('006DEMO0000000015', t - 2, 'call', 'Procurement panel moved to next month. Moved to best case.', 'Dev Patel')
  ) as v(ext, happened_on, kind, note, actor)
  join opportunities o on o.external_id = v.ext;

  insert into followups (opportunity_id, note, owner, due, resolved_at, evidence)
  select o.id, v.note, v.owner, v.due, v.resolved_at, v.evidence
  from (values
    ('006DEMO0000000002', 'Get a dated close plan for Tasman Foods or move it out of commit', 'Mere Walker', t - 4, null::timestamptz, null),
    ('006DEMO0000000004', 'Check Southern Dairy has a signer named before it stays in commit', 'Ben Sutherland', t + 2, null, null),
    ('006DEMO0000000012', 'Upload the signed Hawkes Bay Orchards contract', 'Dev Patel', t - 1, null, null),
    ('006DEMO0000000005', 'Send the board paper summary to Pacific Health', 'Chloe Liu', t - 6, (t - 5)::timestamptz, 'Sent with the reference site list')
  ) as v(ext, note, owner, due, resolved_at, evidence)
  join opportunities o on o.external_id = v.ext;

  insert into events (actor, action, entity, detail) values ('seed', 'seed', 'demo', '{"note": "Fictional demo data"}');
end $$;

#!/usr/bin/env node
// The one CLI. Every slash command in .claude/commands drives this file.
//   npm run forecast -- <command> [--flags] [--json]
// Reads print tables; --json prints machine output. Writes need --actor and accept --dry-run.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, money, heading, truncate } from './lib/format.mjs';

// command -> [required flags, optional flags, description]
export const commands = {
  help: [[], [], 'List every command.'],
  periods: [[], [], 'Forecast periods with quota, guidance and status.'],
  reps: [[], [], 'Reps, their manager and team.'],
  forecast: [[], ['period'], 'The roll-up: quota, won, commit, best case, pipeline, the rep call and the gap, per rep.'],
  pipeline: [[], ['period', 'rep', 'category'], 'Open deals in the period.'],
  deal: [['deal'], [], 'One deal: its record, every change, activity, follow-ups and risks.'],
  risk: [[], ['period', 'rep'], 'Open deals carrying a risk: passed close date, no next step, gone quiet, pushed, early commit.'],
  movement: [[], ['period', 'since'], 'The waterfall: what was won, lost, pushed, pulled in, added or changed since a date.'],
  slipped: [[], ['period'], 'Deals whose close date has been pushed, with the original date.'],
  accuracy: [[], ['period'], 'How close each rep\'s first and last call came to what they won, for closed periods.'],
  'what-if': [[], ['period', 'exclude'], 'Commit with the risky deals taken out (exclude: slippers, quiet, early-commit, passed, all-risk).'],
  calls: [[], ['period'], 'Every forecast call submitted in the period.'],
  'forecast-call': [[], ['period'], 'The Monday forecast call run sheet: each rep\'s call against the system and the deals to inspect.'],
  attention: [[], ['period'], 'What needs a decision this week.'],
  compliance: [[], [], 'Records checked against the rules in docs/compliance.md.'],
  'weekly-review': [[], ['period'], 'Forecast, movement, risk and attention in one read.'],
  activity: [[], ['limit'], 'Recent writes, who made them.'],
  export: [[], ['out'], 'Write every table to JSON in ./exports (or --out).'],
  'add-rep': [['code', 'name', 'actor'], ['manager', 'team'], 'Add a rep.'],
  'add-period': [['name', 'starts', 'ends', 'currency', 'actor'], ['guidance'], 'Add a forecast period.'],
  'set-quota': [['period', 'rep', 'amount', 'actor'], [], 'Set a rep\'s quota for a period.'],
  'set-guidance': [['period', 'amount', 'actor'], [], 'Record the revenue guidance published for a period.'],
  'set-rule': [['key', 'value', 'actor'], [], 'Change a forecast rule (stale_days, commit_min_probability, push_limit).'],
  'add-deal': [['name', 'rep', 'stage', 'amount', 'close', 'actor'], ['account', 'category', 'currency', 'next-step', 'next-step-on'], 'Add a deal.'],
  'update-deal': [['deal', 'actor'], ['stage', 'amount', 'close', 'category', 'owner', 'next-step', 'next-step-on', 'contract-signed', 'lost-reason'], 'Change a deal. Stage, amount, close date, category and owner changes are kept in its history.'],
  log: [['deal', 'note', 'actor'], ['kind', 'on'], 'Log an activity on a deal.'],
  call: [['rep', 'commit', 'best-case', 'actor'], ['period', 'note'], 'Submit a rep\'s forecast call. Calls are never edited; a new call is a new row.'],
  snapshot: [['actor'], ['date'], 'Save the open pipeline as it stands today. Run it every Monday.'],
  'close-period': [['period', 'actor'], [], 'Close a period once no open deals remain in it.'],
  followup: [['note', 'owner', 'due', 'actor'], ['deal'], 'Add a follow-up.'],
  resolve: [['followup', 'evidence', 'actor'], [], 'Close a follow-up with the evidence.'],
  import: [['file', 'actor'], ['history', 'currency', 'date-format'], 'Bring deals across from a Salesforce export: import salesforce --file=Opportunity.csv [--history=OpportunityHistory.csv].'],
  'draft-forecast-note': [[], ['period'], 'Draft the weekly forecast note for leadership into drafts/.'],
  'draft-deal-review': [[], ['period'], 'Draft the questions for each rep about their risky deals into drafts/.'],
};

const WRITES = new Set(['add-rep', 'add-period', 'set-quota', 'set-guidance', 'set-rule', 'add-deal', 'update-deal', 'log', 'call', 'snapshot', 'close-period', 'followup', 'resolve', 'import']);
const CATEGORIES = ['pipeline', 'best_case', 'commit', 'closed', 'omitted'];
const RULES = ['stale_days', 'commit_min_probability', 'push_limit', 'guidance_review_pct', 'guidance_material_pct'];
const TABLES = ['settings', 'stages', 'reps', 'accounts', 'periods', 'quotas', 'opportunities', 'opportunity_history', 'snapshots', 'forecast_calls', 'activities', 'followups', 'events'];

// ---------------------------------------------------------------- input checks

export function date(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) throw Error(`Expected a date as YYYY-MM-DD, got "${s}"`);
  return s;
}
export function cents(s) {
  const clean = String(s).replace(/[,\s]/g, '').replace(/^[A-Z]{3}/, '').replace(/^\$/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) throw Error(`Expected an amount like 45000 or 45000.50, got "${s}"`);
  const [whole, frac = ''] = clean.split('.');
  const n = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(n) || n > 9e14) throw Error('Amount too large');
  return n;
}
function currency(s) {
  if (!/^[A-Z]{3}$/.test(s)) throw Error('Currency must be three capital letters, like NZD or AUD');
  return s;
}
function category(s) {
  const map = { 'best case': 'best_case', bestcase: 'best_case', forecast: 'commit' };
  const v = map[String(s).trim().toLowerCase()] || String(s).trim().toLowerCase().replace(/\s+/g, '_');
  if (!CATEGORIES.includes(v)) throw Error(`Forecast category must be one of ${CATEGORIES.join(', ')}`);
  return v;
}
function positiveInt(s) {
  if (!/^\d{1,4}$/.test(String(s))) throw Error('Expected a whole number');
  return Number(s);
}
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

function parse(args) {
  const [cmd = 'help', ...rest] = args;
  if (!(cmd in commands)) throw Error(`Unknown command: ${cmd}. Run help for the list.`);
  const [required, optional] = commands[cmd];
  const flags = {};
  const pos = [];
  for (const arg of rest) {
    if (!arg.startsWith('--')) { pos.push(arg); continue; }
    const [key, ...parts] = arg.slice(2).split('=');
    if (key in flags) throw Error(`Duplicate flag: --${key}`);
    flags[key] = parts.length ? parts.join('=') : true;
  }
  const allowed = new Set([...required, ...optional, 'json', ...(WRITES.has(cmd) ? ['dry-run'] : [])]);
  for (const k of Object.keys(flags)) if (!allowed.has(k)) throw Error(`Unknown flag for ${cmd}: --${k}`);
  for (const k of ['json', 'dry-run']) if (k in flags && flags[k] !== true) throw Error(`--${k} does not take a value`);
  for (const k of required) if (typeof flags[k] !== 'string' || !flags[k].trim()) throw Error(`${cmd} needs --${k}=value`);
  for (const k of optional) if (k in flags && typeof flags[k] !== 'string') throw Error(`--${k} needs a value`);
  if (cmd === 'import') { if (pos.join(' ') !== 'salesforce') throw Error('Use: import salesforce --file=Opportunity.csv'); }
  else if (pos.length) throw Error(`Unexpected argument: ${pos.join(' ')}`);
  for (const k of Object.keys(flags)) if (typeof flags[k] === 'string') flags[k] = flags[k].trim();
  return { cmd, f: flags };
}

// ---------------------------------------------------------------- lookups

// Exact id, external id or name first, then a unique partial match. Ambiguous or missing lists the candidates.
async function find(db, kind, ref) {
  const spec = {
    reps: { sql: 'select id, code, name from reps order by name', fields: ['code', 'name'] },
    periods: { sql: 'select id, name from periods order by starts', fields: ['name'] },
    opportunities: { sql: 'select o.id, o.external_id, o.name, a.name as account from opportunities o left join accounts a on a.id = o.account_id order by o.name', fields: ['external_id', 'name', 'account'] },
    followups: { sql: 'select id, note from followups where resolved_at is null order by due', fields: ['note'] },
  }[kind];
  const rows = await db.query(spec.sql);
  const n = ref.toLowerCase();
  let found = rows.filter((r) => r.id === n || spec.fields.some((k) => String(r[k] ?? '').toLowerCase() === n));
  if (!found.length) found = rows.filter((r) => r.id.startsWith(n) || spec.fields.some((k) => String(r[k] ?? '').toLowerCase().includes(n)));
  if (found.length === 1) return found[0];
  const list = (found.length ? found : rows).slice(0, 20).map((r) => `  ${r.id.slice(0, 8)}  ${spec.fields.map((k) => r[k] ?? '').join(' | ')}`).join('\n');
  const label = { reps: 'rep', periods: 'period', opportunities: 'deal', followups: 'open follow-up' }[kind];
  throw Error(`${found.length ? 'More than one' : 'No'} ${label} matches "${ref}":\n${list}`);
}

async function period(db, ref) {
  if (ref) return (await db.query('select * from periods where id = $1', [(await find(db, 'periods', ref)).id]))[0];
  const rows = await db.query("select * from periods where status = 'open' and current_date between starts and ends order by starts");
  if (rows.length) return rows[0];
  const all = await db.query('select name, starts, ends, status from periods order by starts');
  throw Error('No open period covers today. Pick one with --period=<name>:\n' + all.map((p) => `  ${p.name}  ${p.starts} to ${p.ends}  ${p.status}`).join('\n'));
}

async function setting(db, key) {
  return Number((await db.query('select value from settings where key = $1', [key]))[0]?.value);
}

async function logEvent(db, actor, action, entity, detail = {}) {
  await db.query('insert into events (actor, action, entity, detail) values ($1, $2, $3, $4)', [actor, action, entity, JSON.stringify(detail)]);
}

// ---------------------------------------------------------------- reads

async function forecastRows(db, p) {
  return db.query('select * from v_forecast where period_id = $1 order by rep', [p.id]);
}
function totals(rows) {
  const sum = (k) => rows.reduce((t, r) => t + Number(r[k] || 0), 0);
  const quota = sum('quota_cents'), won = sum('won_cents');
  return {
    rep: 'Team', quota_cents: quota, won_cents: won, commit_cents: sum('commit_cents'), best_case_cents: sum('best_case_cents'),
    pipeline_cents: sum('pipeline_cents'), call_commit_cents: sum('call_commit_cents'), call_vs_system_cents: sum('call_vs_system_cents'),
    gap_cents: Math.max(quota - sum('commit_cents'), 0), open_deals: sum('open_deals'),
    coverage: quota > won ? Math.round((100 * sum('pipeline_cents')) / (quota - won)) / 100 : null,
    attained_pct: quota ? Math.round((100 * won) / quota) : null,
  };
}

async function risks(db, p, rep) {
  const rows = await db.query(
    `select r.id, r.deal, r.account, r.rep, r.stage, r.forecast_category, r.amount_cents, r.currency, r.close_date,
            string_agg(r.risk || ' (' || r.detail || ')', '; ' order by r.risk) as risks, count(*)::int as risk_count
       from v_deal_risk r where r.period_id = $1 group by r.id, r.deal, r.account, r.rep, r.stage, r.forecast_category, r.amount_cents, r.currency, r.close_date
      order by case r.forecast_category when 'commit' then 1 when 'best_case' then 2 else 3 end, r.amount_cents desc`, [p.id]);
  return rep ? rows.filter((r) => r.rep.toLowerCase().includes(rep.toLowerCase())) : rows;
}

async function movementRows(db, p, since) {
  const base = (await db.query('select max(taken_on) as d from snapshots where taken_on <= $1', [since]))[0].d;
  if (!base) throw Error(`No snapshot on or before ${since}. Run snapshot every Monday so there is a week to compare against.`);
  const rows = await db.query('select * from movement($1, $2)', [p.id, since]);
  return { since: base, rows };
}

async function attentionRows(db, p) {
  const out = [];
  for (const r of await risks(db, p)) {
    if (r.forecast_category === 'commit' || r.risk_count >= 2) out.push({ kind: 'risky deal', item: `${r.deal} (${r.rep})`, detail: truncate(r.risks, 90) });
  }
  for (const f of await db.query("select f.note, f.owner, f.due, o.name as deal from followups f left join opportunities o on o.id = f.opportunity_id where f.resolved_at is null and f.due < current_date order by f.due")) {
    out.push({ kind: 'overdue follow-up', item: f.note, detail: `${f.owner}, due ${f.due}` });
  }
  const weekAgo = addDays(today(), -7);
  for (const r of await db.query('select rep, call_on from v_forecast where period_id = $1 and quota_cents > 0', [p.id])) {
    if (!r.call_on || r.call_on < weekAgo) out.push({ kind: 'no call this week', item: r.rep, detail: r.call_on ? `last call ${r.call_on}` : 'no call this period' });
  }
  for (const c of await db.query("select rule, item, issue from v_compliance where severity = 'breach'")) {
    out.push({ kind: 'compliance', item: c.item, detail: `${c.rule}: ${c.issue}` });
  }
  const snap = (await db.query('select max(taken_on) as d from snapshots'))[0].d;
  if (!snap || snap < weekAgo) out.push({ kind: 'no snapshot this week', item: 'pipeline snapshot', detail: snap ? `last taken ${snap}` : 'never taken' });
  return out;
}

async function whatIf(db, p, exclude = 'all-risk') {
  const kinds = { slippers: ['repeat slipper'], quiet: ['gone quiet'], 'early-commit': ['commit at an early stage'], passed: ['close date passed'],
    'all-risk': ['repeat slipper', 'gone quiet', 'commit at an early stage', 'close date passed', 'no next step', 'next step overdue'] }[exclude];
  if (!kinds) throw Error('--exclude must be slippers, quiet, early-commit, passed or all-risk');
  const removed = await db.query(
    `select distinct r.id, r.deal, r.rep, r.amount_cents, r.currency from v_deal_risk r
      where r.period_id = $1 and r.forecast_category = 'commit' and r.risk = any($2) order by r.amount_cents desc`, [p.id, kinds]);
  const rows = await forecastRows(db, p);
  const by = {};
  for (const d of removed) by[d.rep] = (by[d.rep] || 0) + Number(d.amount_cents);
  const reps = rows.filter((r) => r.quota_cents > 0 || r.commit_cents > 0).map((r) => ({
    rep: r.rep, quota_cents: r.quota_cents, commit_cents: r.commit_cents, removed_cents: by[r.rep] || 0,
    adjusted_commit_cents: r.commit_cents - (by[r.rep] || 0), currency: r.currency,
    adjusted_attainment_pct: r.quota_cents ? Math.round((100 * (r.commit_cents - (by[r.rep] || 0))) / r.quota_cents) : null,
  }));
  return { exclude, removed, reps };
}

async function forecastCall(db, p) {
  const rows = await forecastRows(db, p);
  const r = await risks(db, p);
  return rows.filter((x) => x.quota_cents > 0 || x.open_deals > 0).map((x) => ({
    rep: x.rep, quota_cents: x.quota_cents, won_cents: x.won_cents, system_commit_cents: x.commit_cents, call_commit_cents: x.call_commit_cents,
    call_vs_system_cents: x.call_vs_system_cents, gap_cents: x.gap_cents, currency: x.currency,
    inspect: r.filter((d) => d.rep === x.rep && ['commit', 'best_case'].includes(d.forecast_category)).map((d) => `${d.deal} ${money(d.amount_cents, d.currency)}: ${d.risks}`),
  }));
}

async function slipped(db, p) {
  return db.query(
    `with pushes as (
       select h.opportunity_id, count(*)::int as pushes, min(h.old_value) as first_close
         from opportunity_history h where h.field = 'close_date' and h.new_value > h.old_value group by h.opportunity_id)
     select d.deal, d.account, d.rep, d.forecast_category as category, d.amount_cents, d.currency, x.first_close as original_close,
            d.close_date as close_now, x.pushes, (d.close_date - x.first_close::date) as days_slipped
       from pushes x join v_deals d on d.id = x.opportunity_id, periods p
      where p.id = $1 and not d.is_closed and (d.close_date between p.starts and p.ends or x.first_close::date between p.starts and p.ends)
      order by x.pushes desc, days_slipped desc`, [p.id]);
}

// ---------------------------------------------------------------- execute

export async function execute(db, args) {
  const { cmd, f } = parse(args);
  const actor = f.actor;
  const dry = !!f['dry-run'];
  const write = async (fn) => {
    await db.exec('BEGIN');
    try {
      const result = await fn();
      await db.exec(dry ? 'ROLLBACK' : 'COMMIT');
      return dry ? { dry_run: true, would: result } : result;
    } catch (e) {
      await db.exec('ROLLBACK');
      throw e;
    }
  };

  switch (cmd) {
    case 'help':
      return Object.entries(commands).map(([name, [req, opt, desc]]) => ({ command: name, flags: [...req.map((x) => `--${x}`), ...opt.map((x) => `[--${x}]`)].join(' '), does: desc }));
    case 'periods':
      return db.query(`select p.name, p.starts, p.ends, p.currency, p.status, p.guidance_cents,
        (select coalesce(sum(amount_cents), 0)::bigint from quotas q where q.period_id = p.id) as quota_cents from periods p order by p.starts`);
    case 'reps':
      return db.query('select code, name, manager, team, active from reps order by name');
    case 'forecast': {
      const p = await period(db, f.period);
      const rows = (await forecastRows(db, p)).filter((r) => r.quota_cents > 0 || r.open_deals > 0 || r.won_cents > 0);
      return { period: p.name, currency: p.currency, guidance_cents: p.guidance_cents, rows, total: totals(rows) };
    }
    case 'pipeline': {
      const p = await period(db, f.period);
      let rows = await db.query(`select deal, account, rep, stage, probability, forecast_category as category, amount_cents, currency, close_date,
        next_step, next_step_on, last_activity_on, pushes from v_deals where period_id = $1 and not is_closed order by amount_cents desc`, [p.id]);
      if (f.rep) rows = rows.filter((r) => r.rep.toLowerCase().includes(f.rep.toLowerCase()));
      if (f.category) rows = rows.filter((r) => r.category === category(f.category));
      return { period: p.name, rows };
    }
    case 'deal': {
      const o = await find(db, 'opportunities', f.deal);
      const [deal] = await db.query('select * from v_deals where id = $1', [o.id]);
      return {
        deal,
        history: await db.query('select changed_on, field, old_value, new_value, actor from opportunity_history where opportunity_id = $1 order by changed_on, created_at', [o.id]),
        activities: await db.query('select happened_on, kind, note, actor from activities where opportunity_id = $1 order by happened_on desc', [o.id]),
        followups: await db.query('select note, owner, due, resolved_at, evidence from followups where opportunity_id = $1 order by due', [o.id]),
        risks: await db.query('select risk, detail from v_deal_risk where id = $1', [o.id]),
      };
    }
    case 'risk': {
      const p = await period(db, f.period);
      return { period: p.name, rows: await risks(db, p, f.rep) };
    }
    case 'movement': {
      const p = await period(db, f.period);
      const since = f.since ? date(f.since) : addDays(today(), -7);
      const m = await movementRows(db, p, since);
      const net = m.rows.reduce((t, r) => t + Number(r.delta_cents), 0);
      return { period: p.name, currency: p.currency, since: m.since, net_cents: net, rows: m.rows };
    }
    case 'slipped': {
      const p = await period(db, f.period);
      return { period: p.name, rows: await slipped(db, p) };
    }
    case 'accuracy': {
      const rows = f.period
        ? await db.query('select * from v_accuracy where period_id = $1 order by abs(first_call_error_pct) desc nulls last', [(await period(db, f.period)).id])
        : await db.query('select * from v_accuracy order by period, abs(first_call_error_pct) desc nulls last');
      return rows;
    }
    case 'what-if': {
      const p = await period(db, f.period);
      return { period: p.name, ...(await whatIf(db, p, f.exclude || 'all-risk')) };
    }
    case 'calls': {
      const p = await period(db, f.period);
      return { period: p.name, rows: await db.query(`select c.submitted_on, r.name as rep, c.commit_cents, c.best_case_cents, p.currency, c.note, c.actor
        from forecast_calls c join reps r on r.id = c.rep_id join periods p on p.id = c.period_id where c.period_id = $1 order by c.submitted_on desc, r.name`, [p.id]) };
    }
    case 'forecast-call': {
      const p = await period(db, f.period);
      return { period: p.name, rows: await forecastCall(db, p) };
    }
    case 'attention': {
      const p = await period(db, f.period);
      return { period: p.name, rows: await attentionRows(db, p) };
    }
    case 'compliance':
      return db.query("select severity, rule, item, issue from v_compliance order by case severity when 'breach' then 1 else 2 end, rule, item");
    case 'weekly-review': {
      const p = await period(db, f.period);
      const rows = (await forecastRows(db, p)).filter((r) => r.quota_cents > 0 || r.open_deals > 0);
      let movement = null;
      try { movement = await movementRows(db, p, addDays(today(), -7)); } catch { movement = { since: null, rows: [] }; }
      return {
        period: p.name, currency: p.currency, guidance_cents: p.guidance_cents, forecast: rows, total: totals(rows),
        movement, risk: await risks(db, p), whatif: await whatIf(db, p, 'all-risk'), attention: await attentionRows(db, p),
      };
    }
    case 'activity':
      return db.query('select at, actor, action, entity, detail from events order by at desc limit $1', [f.limit ? positiveInt(f.limit) : 25]);
    case 'export': {
      const out = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, f.out || 'exports');
      mkdirSync(out, { recursive: true });
      const counts = {};
      for (const t of TABLES) {
        const rows = await db.query(`select * from ${t}`);
        writeFileSync(path.join(out, `${t}.json`), JSON.stringify(rows, null, 2));
        counts[t] = rows.length;
      }
      return { folder: out, counts };
    }

    // ------------------------------------------------------------ writes
    case 'add-rep':
      return write(async () => {
        const [r] = await db.query('insert into reps (code, name, manager, team) values ($1, $2, $3, $4) returning code, name', [f.code.toUpperCase(), f.name, f.manager || '', f.team || '']);
        await logEvent(db, actor, 'add-rep', r.code, r);
        return r;
      });
    case 'add-period':
      return write(async () => {
        const [p] = await db.query('insert into periods (name, starts, ends, currency, guidance_cents) values ($1, $2, $3, $4, $5) returning name, starts, ends, currency',
          [f.name, date(f.starts), date(f.ends), currency(f.currency), f.guidance ? cents(f.guidance) : null]);
        const overlap = await db.query('select name from periods where name <> $1 and starts <= $3 and ends >= $2', [f.name, f.starts, f.ends]);
        if (overlap.length) throw Error(`Periods cannot overlap. ${f.name} overlaps ${overlap.map((o) => o.name).join(', ')}`);
        await logEvent(db, actor, 'add-period', p.name, p);
        return p;
      });
    case 'set-quota':
      return write(async () => {
        const p = await period(db, f.period), r = await find(db, 'reps', f.rep), amount = cents(f.amount);
        await db.query('insert into quotas (period_id, rep_id, amount_cents) values ($1, $2, $3) on conflict (period_id, rep_id) do update set amount_cents = excluded.amount_cents', [p.id, r.id, amount]);
        await logEvent(db, actor, 'set-quota', `${p.name} ${r.name}`, { amount_cents: amount });
        return { period: p.name, rep: r.name, quota_cents: amount };
      });
    case 'set-guidance':
      return write(async () => {
        const p = await period(db, f.period), amount = cents(f.amount);
        await db.query('update periods set guidance_cents = $2 where id = $1', [p.id, amount]);
        await logEvent(db, actor, 'set-guidance', p.name, { from: p.guidance_cents, to: amount });
        return { period: p.name, guidance_cents: amount };
      });
    case 'set-rule':
      return write(async () => {
        if (!RULES.includes(f.key)) throw Error(`Rule must be one of ${RULES.join(', ')}`);
        const v = positiveInt(f.value);
        const [old] = await db.query('select value from settings where key = $1', [f.key]);
        await db.query('update settings set value = $2 where key = $1', [f.key, String(v)]);
        await logEvent(db, actor, 'set-rule', f.key, { from: old?.value, to: v });
        return { rule: f.key, from: old?.value, to: v };
      });
    case 'add-deal':
      return write(async () => {
        const r = await find(db, 'reps', f.rep);
        const stage = await stageRow(db, f.stage);
        const cat = f.category ? category(f.category) : stage.is_closed ? (stage.is_won ? 'closed' : 'omitted') : 'pipeline';
        const acct = f.account ? await accountId(db, f.account) : null;
        const per = await db.query("select currency from periods where $1 between starts and ends", [date(f.close)]);
        const cur = f.currency ? currency(f.currency) : per[0]?.currency || 'NZD';
        const [o] = await db.query(`insert into opportunities (name, account_id, owner_id, stage, amount_cents, currency, close_date, forecast_category, next_step, next_step_on, last_activity_on, closed_on)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, current_date, $11) returning id, name`,
          [f.name, acct, r.id, stage.name, cents(f.amount), cur, f.close, cat, f['next-step'] || '', f['next-step-on'] ? date(f['next-step-on']) : null, stage.is_closed ? f.close : null]);
        await logEvent(db, actor, 'add-deal', o.name, { id: o.id });
        return o;
      });
    case 'update-deal':
      return write(async () => {
        const o = await find(db, 'opportunities', f.deal);
        const [cur] = await db.query('select * from opportunities where id = $1', [o.id]);
        const changes = {};
        const hist = [];
        if (f.stage) {
          const st = await stageRow(db, f.stage);
          if (st.name !== cur.stage) {
            hist.push(['stage', cur.stage, st.name]);
            changes.stage = st.name;
            if (st.is_closed) { changes.closed_on = today(); if (!f.category) changes.forecast_category = st.is_won ? 'closed' : 'omitted'; }
          }
        }
        if (f.amount && cents(f.amount) !== Number(cur.amount_cents)) { hist.push(['amount', String(Number(cur.amount_cents) / 100), String(cents(f.amount) / 100)]); changes.amount_cents = cents(f.amount); }
        if (f.close && date(f.close) !== cur.close_date) { hist.push(['close_date', cur.close_date, f.close]); changes.close_date = f.close; }
        if (f.category && category(f.category) !== cur.forecast_category) { hist.push(['forecast_category', cur.forecast_category, category(f.category)]); changes.forecast_category = category(f.category); }
        if (f.owner) {
          const r = await find(db, 'reps', f.owner);
          if (r.id !== cur.owner_id) {
            const [was] = await db.query('select name from reps where id = $1', [cur.owner_id]);
            hist.push(['owner', was.name, r.name]);
            changes.owner_id = r.id;
          }
        }
        if (f['next-step'] !== undefined) changes.next_step = f['next-step'];
        if (f['next-step-on']) changes.next_step_on = date(f['next-step-on']);
        if (f['contract-signed']) changes.contract_signed_on = date(f['contract-signed']);
        if (f['lost-reason']) changes.lost_reason = f['lost-reason'];
        if (!Object.keys(changes).length) return { deal: o.name, changed: [] };
        const keys = Object.keys(changes);
        await db.query(`update opportunities set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`, [o.id, ...keys.map((k) => changes[k])]);
        for (const [field, oldV, newV] of hist) {
          await db.query('insert into opportunity_history (opportunity_id, changed_on, field, old_value, new_value, actor) values ($1, current_date, $2, $3, $4, $5)', [o.id, field, oldV, newV, actor]);
        }
        await logEvent(db, actor, 'update-deal', o.name, changes);
        return { deal: o.name, changed: keys };
      });
    case 'log':
      return write(async () => {
        const o = await find(db, 'opportunities', f.deal);
        const on = f.on ? date(f.on) : today();
        await db.query('insert into activities (opportunity_id, happened_on, kind, note, actor) values ($1, $2, $3, $4, $5)', [o.id, on, f.kind || 'note', f.note, actor]);
        await db.query('update opportunities set last_activity_on = greatest(coalesce(last_activity_on, $2::date), $2::date) where id = $1', [o.id, on]);
        await logEvent(db, actor, 'log', o.name, { note: f.note });
        return { deal: o.name, logged: on };
      });
    case 'call':
      return write(async () => {
        const p = await period(db, f.period), r = await find(db, 'reps', f.rep);
        if (p.status !== 'open') throw Error(`${p.name} is closed. Calls go on open periods.`);
        const c = cents(f.commit), b = cents(f['best-case']);
        if (b < c) throw Error('Best case cannot be lower than commit');
        await db.query('insert into forecast_calls (period_id, rep_id, commit_cents, best_case_cents, note, actor) values ($1, $2, $3, $4, $5, $6)', [p.id, r.id, c, b, f.note || '', actor]);
        await logEvent(db, actor, 'call', `${p.name} ${r.name}`, { commit_cents: c, best_case_cents: b });
        return { period: p.name, rep: r.name, commit_cents: c, best_case_cents: b, currency: p.currency };
      });
    case 'snapshot':
      return write(async () => {
        const on = f.date ? date(f.date) : today();
        await db.query('delete from snapshots where taken_on = $1', [on]);
        const rows = await db.query(`insert into snapshots (taken_on, opportunity_id, owner_id, stage, amount_cents, currency, close_date, forecast_category)
          select $1, o.id, o.owner_id, o.stage, o.amount_cents, o.currency, o.close_date, o.forecast_category
            from opportunities o join stages s on s.name = o.stage where not s.is_closed returning id`, [on]);
        await logEvent(db, actor, 'snapshot', on, { deals: rows.length });
        return { taken_on: on, deals: rows.length };
      });
    case 'close-period':
      return write(async () => {
        const p = await period(db, f.period);
        if (p.status === 'closed') throw Error(`${p.name} is already closed`);
        const open = await db.query('select deal, rep, close_date from v_deals where period_id = $1 and not is_closed', [p.id]);
        if (open.length) throw Error(`${p.name} still has ${open.length} open deal(s). Win, lose or move each one first:\n` + open.map((d) => `  ${d.deal} (${d.rep}) ${d.close_date}`).join('\n'));
        await db.query("update periods set status = 'closed', closed_at = now(), closed_by = $2 where id = $1", [p.id, actor]);
        await logEvent(db, actor, 'close-period', p.name);
        return { period: p.name, status: 'closed' };
      });
    case 'followup':
      return write(async () => {
        const o = f.deal ? await find(db, 'opportunities', f.deal) : null;
        const [row] = await db.query('insert into followups (opportunity_id, note, owner, due) values ($1, $2, $3, $4) returning id, note, owner, due', [o?.id || null, f.note, f.owner, date(f.due)]);
        await logEvent(db, actor, 'followup', f.note, { due: f.due });
        return row;
      });
    case 'resolve':
      return write(async () => {
        const fu = await find(db, 'followups', f.followup);
        await db.query('update followups set resolved_at = now(), evidence = $2 where id = $1', [fu.id, f.evidence]);
        await logEvent(db, actor, 'resolve', fu.note, { evidence: f.evidence });
        return { resolved: fu.note };
      });
    case 'import':
      return write(() => importSalesforce(db, f));
    case 'draft-forecast-note':
      return draftForecastNote(db, await period(db, f.period));
    case 'draft-deal-review':
      return draftDealReview(db, await period(db, f.period));
  }
  throw Error(`Unhandled command ${cmd}`);
}

async function stageRow(db, name) {
  const rows = await db.query('select * from stages where lower(name) = lower($1)', [name]);
  if (rows.length) return rows[0];
  const all = await db.query('select name from stages order by sort');
  throw Error(`Unknown stage "${name}". Stages: ${all.map((s) => s.name).join(', ')}`);
}
async function accountId(db, name) {
  const [a] = await db.query('insert into accounts (name) values ($1) on conflict (name) do update set name = excluded.name returning id', [name]);
  return a.id;
}

// ---------------------------------------------------------------- import

// Salesforce dates come out as ISO from Data Loader and as the user's locale from a report.
// New Zealand and Australian locales are day first; pass --date-format=mdy for a US-locale export.
export function sfDate(v, order = 'dmy') {
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return date(`${m[1]}-${m[2]}-${m[3]}`);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [d, mo] = order === 'mdy' ? [m[2], m[1]] : [m[1], m[2]];
    return date(`${m[3]}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
  }
  throw Error(`Cannot read the date "${s}"`);
}
function sfAmount(v) {
  const s = String(v || '').replace(/[A-Z]{3}|\$|,|\s/g, '');
  return s ? cents(s) : 0;
}
function initials(name, taken) {
  const base = name.split(/\s+/).map((w) => w[0] || '').join('').toUpperCase().slice(0, 3) || 'REP';
  let code = base, n = 2;
  while (taken.has(code)) code = base + n++;
  taken.add(code);
  return code;
}

async function importSalesforce(db, f) {
  const order = f['date-format'] || 'dmy';
  if (!['dmy', 'mdy'].includes(order)) throw Error('--date-format must be dmy or mdy');
  const defaultCurrency = f.currency ? currency(f.currency) : 'NZD';
  const rows = parseCsv(readFileSync(path.resolve(f.file), 'utf8'));
  if (!rows.length) throw Error('The file has no rows');
  const taken = new Set((await db.query('select code from reps')).map((r) => r.code));
  const counts = { deals_added: 0, deals_updated: 0, unchanged: 0, reps_added: 0, accounts_added: 0, stages_added: 0, history_rows: 0 };
  const idMap = new Map();

  for (const [i, row] of rows.entries()) {
    const line = i + 2;
    const ext = pick(row, 'Opportunity ID', 'Opportunity Id', 'Id');
    const name = pick(row, 'Opportunity Name', 'Name');
    const stageName = pick(row, 'Stage', 'StageName');
    if (!ext || !name || !stageName) throw Error(`Row ${line}: needs Opportunity ID, Opportunity Name and Stage`);

    // Owner: by Salesforce user id if the export has one, else by name.
    const ownerName = pick(row, 'Opportunity Owner', 'Owner Name', 'Owner.Name', 'OwnerName');
    const ownerId = pick(row, 'Owner ID', 'OwnerId');
    let rep = ownerId ? (await db.query('select id from reps where external_id = $1', [ownerId]))[0] : null;
    if (!rep && ownerName) rep = (await db.query('select id from reps where lower(name) = lower($1)', [ownerName]))[0];
    if (!rep) {
      const label = ownerName || ownerId;
      if (!label) throw Error(`Row ${line}: needs Opportunity Owner or OwnerId`);
      [rep] = await db.query('insert into reps (code, name, external_id) values ($1, $2, $3) returning id', [initials(label, taken), label, ownerId || null]);
      counts.reps_added++;
    }

    const accountName = pick(row, 'Account Name', 'Account.Name', 'AccountName');
    let account = null;
    if (accountName) {
      const existing = await db.query('select id from accounts where name = $1', [accountName]);
      if (existing.length) account = existing[0].id;
      else { account = await accountId(db, accountName); counts.accounts_added++; }
    }

    let stage = (await db.query('select * from stages where lower(name) = lower($1)', [stageName]))[0];
    if (!stage) {
      const prob = Number(String(pick(row, 'Probability (%)', 'Probability') || 0).replace('%', '')) || 0;
      const closed = /^(true|1|yes)$/i.test(pick(row, 'Closed', 'IsClosed'));
      const won = /^(true|1|yes)$/i.test(pick(row, 'Won', 'IsWon'));
      const sort = Number((await db.query('select coalesce(max(sort), 0) + 5 as s from stages where not is_closed'))[0].s);
      [stage] = await db.query('insert into stages (name, sort, probability, is_closed, is_won) values ($1, $2, $3, $4, $5) returning *', [stageName, sort, Math.min(100, Math.max(0, prob)), closed || won, won]);
      counts.stages_added++;
    }

    const close = sfDate(pick(row, 'Close Date', 'CloseDate'), order);
    if (!close) throw Error(`Row ${line}: needs a Close Date`);
    const catRaw = pick(row, 'Forecast Category', 'ForecastCategoryName', 'ForecastCategory');
    const cat = catRaw ? category(catRaw) : stage.is_closed ? (stage.is_won ? 'closed' : 'omitted') : 'pipeline';
    const prob = pick(row, 'Probability (%)', 'Probability');
    const rec = {
      name, account_id: account, owner_id: rep.id, stage: stage.name, amount_cents: sfAmount(pick(row, 'Amount')),
      currency: currency(pick(row, 'Amount Currency', 'Opportunity Currency', 'CurrencyIsoCode') || defaultCurrency),
      close_date: close, probability: prob === '' ? null : Math.min(100, Math.max(0, Math.round(Number(String(prob).replace('%', ''))))),
      forecast_category: cat, next_step: pick(row, 'Next Step', 'NextStep'),
      last_activity_on: sfDate(pick(row, 'Last Activity', 'LastActivityDate'), order),
      created_on: sfDate(pick(row, 'Created Date', 'CreatedDate'), order) || today(),
      closed_on: stage.is_closed ? close : null,
    };

    const [existing] = await db.query('select * from opportunities where external_id = $1', [ext]);
    if (!existing) {
      const keys = Object.keys(rec);
      const [o] = await db.query(`insert into opportunities (external_id, ${keys.join(', ')}) values ($1, ${keys.map((_, k) => `$${k + 2}`).join(', ')}) returning id`, [ext, ...keys.map((k) => rec[k])]);
      idMap.set(ext, o.id);
      counts.deals_added++;
      continue;
    }
    idMap.set(ext, existing.id);
    const tracked = { stage: 'stage', amount_cents: 'amount', close_date: 'close_date', forecast_category: 'forecast_category', owner_id: 'owner' };
    const diff = Object.keys(rec).filter((k) => k !== 'created_on' && String(rec[k] ?? '') !== String(existing[k] ?? ''));
    if (!diff.length) { counts.unchanged++; continue; }
    await db.query(`update opportunities set ${diff.map((k, n) => `${k} = $${n + 2}`).join(', ')} where id = $1`, [existing.id, ...diff.map((k) => rec[k])]);
    for (const k of diff.filter((k) => tracked[k])) {
      const fmt = (v) => (k === 'amount_cents' ? String(Number(v) / 100) : String(v));
      await db.query('insert into opportunity_history (opportunity_id, changed_on, field, old_value, new_value, actor) values ($1, current_date, $2, $3, $4, $5)', [existing.id, tracked[k], fmt(existing[k]), fmt(rec[k]), f.actor]);
      counts.history_rows++;
    }
    counts.deals_updated++;
  }

  // OpportunityHistory: one row per saved version of a deal. Consecutive versions become field changes.
  if (f.history) {
    const hist = parseCsv(readFileSync(path.resolve(f.history), 'utf8'));
    const byOpp = new Map();
    for (const h of hist) {
      const ext = pick(h, 'OpportunityId', 'Opportunity ID', 'Opportunity Id');
      if (!ext) throw Error('History file needs an OpportunityId column');
      if (!byOpp.has(ext)) byOpp.set(ext, []);
      byOpp.get(ext).push(h);
    }
    for (const [ext, list] of byOpp) {
      let oppId = idMap.get(ext) || (await db.query('select id from opportunities where external_id = $1', [ext]))[0]?.id;
      if (!oppId) continue;
      const versions = list.map((h) => ({
        on: sfDate(pick(h, 'CreatedDate', 'Created Date', 'Last Modified', 'Edit Date'), order),
        stage: pick(h, 'StageName', 'Stage'), amount: String(sfAmount(pick(h, 'Amount')) / 100),
        close_date: sfDate(pick(h, 'CloseDate', 'Close Date'), order),
        forecast_category: (() => { const c = pick(h, 'ForecastCategory', 'Forecast Category'); return c ? category(c) : ''; })(),
      })).sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
      for (let k = 1; k < versions.length; k++) {
        for (const field of ['stage', 'amount', 'close_date', 'forecast_category']) {
          const a = versions[k - 1][field], b = versions[k][field];
          if (!a || !b || a === b) continue;
          const dup = await db.query('select 1 from opportunity_history where opportunity_id = $1 and changed_on = $2 and field = $3 and old_value = $4 and new_value = $5', [oppId, versions[k].on, field, a, b]);
          if (dup.length) continue;
          await db.query('insert into opportunity_history (opportunity_id, changed_on, field, old_value, new_value, actor) values ($1, $2, $3, $4, $5, $6)', [oppId, versions[k].on, field, a, b, 'Salesforce history']);
          counts.history_rows++;
        }
      }
    }
  }
  await logEvent(db, f.actor, 'import', 'salesforce', { file: path.basename(f.file), ...counts });
  return counts;
}

// ---------------------------------------------------------------- drafts (never sent)

function draftPath(name) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function draftForecastNote(db, p) {
  const rows = (await forecastRows(db, p)).filter((r) => r.quota_cents > 0 || r.open_deals > 0);
  const t = totals(rows);
  const c = p.currency;
  let mv = { since: null, rows: [] };
  try { mv = await movementRows(db, p, addDays(today(), -7)); } catch { /* no snapshot yet */ }
  const wi = await whatIf(db, p, 'all-risk');
  const cut = wi.removed.reduce((s, d) => s + Number(d.amount_cents), 0);
  const lines = [
    `# ${p.name} forecast, week of ${today()}`,
    '',
    `Won ${money(t.won_cents, c)} of a ${money(t.quota_cents, c)} quota (${t.attained_pct ?? 0}%). Commit, including won, is ${money(t.commit_cents, c)}; best case ${money(t.best_case_cents, c)}. The reps are calling ${money(t.call_commit_cents, c)}.`,
    p.guidance_cents ? `Published guidance for the period is ${money(p.guidance_cents, c)}. Commit sits ${Math.round((1000 * (t.commit_cents - p.guidance_cents)) / p.guidance_cents) / 10}% from it.` : '',
    `Taking out the ${wi.removed.length} commit deal(s) carrying a risk leaves ${money(t.commit_cents - cut, c)}.`,
    '',
    '## By rep',
    '',
    '| Rep | Quota | Won | Commit | Rep call | Gap |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.rep} | ${money(r.quota_cents, c)} | ${money(r.won_cents, c)} | ${money(r.commit_cents, c)} | ${r.call_commit_cents == null ? 'none' : money(r.call_commit_cents, c)} | ${money(r.gap_cents, c)} |`),
    '',
    `## What moved${mv.since ? ` since ${mv.since}` : ''}`,
    '',
    ...(mv.rows.length ? mv.rows.map((m) => `- ${m.change}: ${m.deal} (${m.rep}) ${m.delta_cents ? money(m.delta_cents, c) : ''} ${m.detail}`.trimEnd()) : ['- No snapshot to compare against yet.']),
    '',
    '## Deals to inspect',
    '',
    ...(wi.removed.length ? wi.removed.map((d) => `- ${d.deal} (${d.rep}) ${money(d.amount_cents, d.currency)}`) : ['- None.']),
    '',
    '_Draft. Read it, edit it, and send it yourself._',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === ''));
  const file = draftPath(`forecast-note-${slug(p.name)}-${today()}.md`);
  writeFileSync(file, lines.join('\n') + '\n');
  return { draft: path.relative(process.env.OUTPUT_DIR || REPO_ROOT, file), period: p.name };
}

async function draftDealReview(db, p) {
  const rows = await risks(db, p);
  const byRep = {};
  for (const r of rows) (byRep[r.rep] ||= []).push(r);
  const ask = {
    'close date passed': 'The close date has passed. What date will it sign, and what has to happen first?',
    'no next step': 'There is no dated next step. What is the next meeting or action, and when?',
    'next step overdue': 'The next step date has passed. Did it happen, and what came of it?',
    'gone quiet': 'Nothing has been logged lately. When did you last speak to the buyer?',
    'repeat slipper': 'This has moved more than once. What changed each time, and why will this date hold?',
    'commit at an early stage': 'It is in commit at an early stage. Who has agreed to sign, and is the budget approved?',
  };
  const lines = [`# ${p.name} deal review questions, ${today()}`, ''];
  for (const [rep, deals] of Object.entries(byRep)) {
    lines.push(`## ${rep}`, '');
    for (const d of deals) {
      lines.push(`**${d.deal}** (${d.account || 'no account'}, ${money(d.amount_cents, d.currency)}, ${d.forecast_category.replace('_', ' ')}, closes ${d.close_date})`, '');
      for (const risk of Object.keys(ask)) if (d.risks.includes(risk)) lines.push(`- ${ask[risk]}`);
      lines.push('');
    }
  }
  lines.push('_Draft. Nothing has been sent._');
  const file = draftPath(`deal-review-${slug(p.name)}-${today()}.md`);
  writeFileSync(file, lines.join('\n') + '\n');
  return { draft: path.relative(process.env.OUTPUT_DIR || REPO_ROOT, file), reps: Object.keys(byRep).length, deals: rows.length };
}

// ---------------------------------------------------------------- text output

const cat = (v) => String(v ?? '').replace(/best_case/g, 'best case');
const m = (c) => (v, r) => (v === null || v === undefined ? '' : money(v, r?.currency || c));
const signed = (c) => (v, r) => (v === null || v === undefined ? '' : (Number(v) > 0 ? '+' : '') + money(v, r?.currency || c));

export function render(cmd, res) {
  const out = [];
  switch (cmd) {
    case 'help':
      return table(res, [{ key: 'command', label: 'command' }, { key: 'does', label: 'what it does', width: 90 }]);
    case 'periods':
      return table(res, [{ key: 'name', label: 'period' }, { key: 'starts', label: 'starts' }, { key: 'ends', label: 'ends' }, { key: 'status', label: 'status' },
        { key: 'quota_cents', label: 'quota', align: 'right', format: (v, r) => money(v, r.currency) }, { key: 'guidance_cents', label: 'guidance', align: 'right', format: (v, r) => (v == null ? '' : money(v, r.currency)) }]);
    case 'reps':
      return table(res, [{ key: 'code', label: 'code' }, { key: 'name', label: 'rep' }, { key: 'manager', label: 'manager' }, { key: 'team', label: 'team' }]);
    case 'forecast': {
      const c = res.currency;
      const cols = [{ key: 'rep', label: 'rep' }, { key: 'quota_cents', label: 'quota', align: 'right', format: m(c) }, { key: 'won_cents', label: 'won', align: 'right', format: m(c) },
        { key: 'commit_cents', label: 'commit', align: 'right', format: m(c) }, { key: 'best_case_cents', label: 'best case', align: 'right', format: m(c) },
        { key: 'pipeline_cents', label: 'open pipeline', align: 'right', format: m(c) }, { key: 'call_commit_cents', label: 'rep call', align: 'right', format: m(c) },
        { key: 'call_vs_system_cents', label: 'call vs commit', align: 'right', format: signed(c) }, { key: 'gap_cents', label: 'gap to quota', align: 'right', format: m(c) },
        { key: 'coverage', label: 'coverage', align: 'right', format: (v) => (v == null ? '' : `${Number(v).toFixed(1)}x`) }];
      out.push(`${res.period} forecast (${c})${res.guidance_cents ? `, guidance ${money(res.guidance_cents, c)}` : ''}`, '');
      out.push(table([...res.rows, res.total], cols));
      return out.join('\n');
    }
    case 'pipeline':
      return `${res.period} open pipeline\n\n` + table(res.rows, [{ key: 'deal', label: 'deal', width: 30 }, { key: 'rep', label: 'rep' }, { key: 'stage', label: 'stage' },
        { key: 'category', label: 'category', format: cat }, { key: 'amount_cents', label: 'amount', align: 'right', format: m() }, { key: 'close_date', label: 'close' }, { key: 'next_step_on', label: 'next step on' }]);
    case 'deal': {
      const d = res.deal;
      out.push(`${d.deal} (${d.account || 'no account'})`, `${d.rep}, ${d.stage} (${d.probability}%), ${d.forecast_category.replace('_', ' ')}, ${money(d.amount_cents, d.currency)}, closes ${d.close_date}`,
        `Next step: ${d.next_step || 'none'}${d.next_step_on ? ` on ${d.next_step_on}` : ''}. Last activity: ${d.last_activity_on || 'none'}. Pushed ${d.pushes} time(s).`);
      if (res.risks.length) out.push(heading('Risks'), table(res.risks, [{ key: 'risk', label: 'risk' }, { key: 'detail', label: 'detail' }]));
      out.push(heading('History'), table(res.history, [{ key: 'changed_on', label: 'on' }, { key: 'field', label: 'field' }, { key: 'old_value', label: 'from' }, { key: 'new_value', label: 'to' }, { key: 'actor', label: 'by' }]));
      out.push(heading('Activity'), table(res.activities, [{ key: 'happened_on', label: 'on' }, { key: 'kind', label: 'kind' }, { key: 'note', label: 'note', width: 70 }]));
      if (res.followups.length) out.push(heading('Follow-ups'), table(res.followups, [{ key: 'due', label: 'due' }, { key: 'owner', label: 'owner' }, { key: 'note', label: 'note', width: 60 }]));
      return out.join('\n');
    }
    case 'risk':
      return `${res.period}: ${res.rows.length} open deal(s) carrying a risk\n\n` + table(res.rows, [{ key: 'deal', label: 'deal', width: 30 }, { key: 'rep', label: 'rep' },
        { key: 'forecast_category', label: 'category', format: cat }, { key: 'amount_cents', label: 'amount', align: 'right', format: m() }, { key: 'close_date', label: 'close' }, { key: 'risks', label: 'risks', width: 240 }]);
    case 'movement':
      return `${res.period} movement since ${res.since}: net ${(res.net_cents > 0 ? '+' : '') + money(res.net_cents, res.currency)}\n\n` +
        table(res.rows, [{ key: 'change', label: 'change' }, { key: 'deal', label: 'deal', width: 30 }, { key: 'rep', label: 'rep' },
          { key: 'from_amount_cents', label: 'was', align: 'right', format: m() }, { key: 'to_amount_cents', label: 'now', align: 'right', format: m() },
          { key: 'delta_cents', label: 'change', align: 'right', format: signed() }, { key: 'detail', label: 'detail', format: cat }]);
    case 'slipped':
      return `${res.period}: deals that have slipped\n\n` + table(res.rows, [{ key: 'deal', label: 'deal', width: 30 }, { key: 'rep', label: 'rep' }, { key: 'category', label: 'category', format: cat },
        { key: 'amount_cents', label: 'amount', align: 'right', format: m() }, { key: 'original_close', label: 'first close' }, { key: 'close_now', label: 'close now' },
        { key: 'pushes', label: 'pushes', align: 'right' }, { key: 'days_slipped', label: 'days', align: 'right' }]);
    case 'accuracy':
      return table(res, [{ key: 'period', label: 'period' }, { key: 'rep', label: 'rep' }, { key: 'first_call_on', label: 'first call on' },
        { key: 'first_call_cents', label: 'first call', align: 'right', format: m() }, { key: 'last_call_cents', label: 'last call', align: 'right', format: m() },
        { key: 'won_cents', label: 'won', align: 'right', format: m() }, { key: 'first_call_error_pct', label: 'first call off by', align: 'right', format: (v) => (v == null ? '' : `${Number(v) > 0 ? '+' : ''}${v}%`) },
        { key: 'last_call_error_pct', label: 'last call off by', align: 'right', format: (v) => (v == null ? '' : `${Number(v) > 0 ? '+' : ''}${v}%`) }]);
    case 'what-if': {
      const t = res.reps.reduce((a, r) => ({ c: a.c + Number(r.commit_cents), x: a.x + Number(r.adjusted_commit_cents) }), { c: 0, x: 0 });
      out.push(`${res.period}: commit without ${res.exclude} deals: ${money(t.x)} (was ${money(t.c)})`, '');
      out.push(table(res.reps, [{ key: 'rep', label: 'rep' }, { key: 'quota_cents', label: 'quota', align: 'right', format: m() }, { key: 'commit_cents', label: 'commit', align: 'right', format: m() },
        { key: 'removed_cents', label: 'taken out', align: 'right', format: m() }, { key: 'adjusted_commit_cents', label: 'commit after', align: 'right', format: m() },
        { key: 'adjusted_attainment_pct', label: 'of quota', align: 'right', format: (v) => (v == null ? '' : `${v}%`) }]));
      if (res.removed.length) out.push('', 'Taken out:', table(res.removed, [{ key: 'deal', label: 'deal' }, { key: 'rep', label: 'rep' }, { key: 'amount_cents', label: 'amount', align: 'right', format: m() }]));
      return out.join('\n');
    }
    case 'calls':
      return table(res.rows, [{ key: 'submitted_on', label: 'on' }, { key: 'rep', label: 'rep' }, { key: 'commit_cents', label: 'commit', align: 'right', format: m() },
        { key: 'best_case_cents', label: 'best case', align: 'right', format: m() }, { key: 'note', label: 'note', width: 50 }]);
    case 'forecast-call':
      out.push(`${res.period} forecast call`);
      for (const r of res.rows) {
        out.push('', `${r.rep}: called ${r.call_commit_cents == null ? 'nothing yet' : money(r.call_commit_cents, r.currency)}, system commit ${money(r.system_commit_cents, r.currency)} (${r.call_vs_system_cents == null ? 'no call' : (r.call_vs_system_cents > 0 ? '+' : '') + money(r.call_vs_system_cents, r.currency)}), gap to quota ${money(r.gap_cents, r.currency)}`);
        for (const d of r.inspect) out.push(`  - ${d}`);
      }
      return out.join('\n');
    case 'attention':
      return `${res.period}: ${res.rows.length} item(s) need a decision\n\n` + table(res.rows, [{ key: 'kind', label: 'kind' }, { key: 'item', label: 'item', width: 45 }, { key: 'detail', label: 'detail', width: 90 }]);
    case 'compliance':
      return table(res, [{ key: 'severity', label: 'severity' }, { key: 'rule', label: 'rule' }, { key: 'item', label: 'item', width: 32 }, { key: 'issue', label: 'issue', width: 80 }]);
    case 'weekly-review': {
      out.push(render('forecast', { period: res.period, currency: res.currency, guidance_cents: res.guidance_cents, rows: res.forecast, total: res.total }));
      out.push(heading('What moved'), res.movement.since ? render('movement', { period: res.period, currency: res.currency, since: res.movement.since, net_cents: res.movement.rows.reduce((t, r) => t + Number(r.delta_cents), 0), rows: res.movement.rows }) : '  No snapshot a week old yet. Run snapshot every Monday.');
      out.push(heading('Commit without the risky deals'), render('what-if', { period: res.period, ...res.whatif }));
      out.push(heading('Needs a decision'), render('attention', { period: res.period, rows: res.attention }));
      return out.join('\n');
    }
    case 'activity':
      return table(res, [{ key: 'at', label: 'at', format: (v) => String(v instanceof Date ? v.toISOString() : v).slice(0, 16).replace('T', ' ') }, { key: 'actor', label: 'by' }, { key: 'action', label: 'action' }, { key: 'entity', label: 'what', width: 50 }]);
    default:
      return JSON.stringify(res, (k, v) => (typeof v === 'bigint' ? Number(v) : v), 2);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  let db;
  try {
    db = await getDb();
    const res = await execute(db, args);
    const cmd = args[0] || 'help';
    console.log(args.includes('--json') ? JSON.stringify(res, null, 2) : render(cmd, res));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}

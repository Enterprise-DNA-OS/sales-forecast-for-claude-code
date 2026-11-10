#!/usr/bin/env node
// npm test: a temporary database, the schema, the demo data, every command, and the Salesforce import.
// Set TEST_DATABASE_URL to run the same checks against an empty disposable Postgres.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { execute, render, commands, sfDate, cents } from './forecast.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forecast-test-'));
process.env.DATA_DIR = path.join(tmp, 'db');
process.env.OUTPUT_DIR = tmp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const actor = '--actor=Test Manager';
const seen = new Set();
let db;

async function run(...args) {
  const res = await execute(db, args);
  seen.add(args[0]);
  const text = render(args[0], res);
  assert.equal(typeof text, 'string', `${args[0]} renders as text`);
  return res;
}
const fails = (args, re) => assert.rejects(() => execute(db, args), re);

try {
  db = await getDb();
  if (db.mode === 'postgres') {
    assert.equal((await db.query("select tablename from pg_tables where schemaname = 'public'")).length, 0, 'TEST_DATABASE_URL must be an empty disposable database');
  }

  // Schema and demo data, twice each: the second run changes nothing.
  await migrate(db);
  assert.equal((await migrate(db)).ran.length, 0);
  await seed(db);
  await seed(db);
  assert.equal((await db.query('select * from reps')).length, 4);
  assert.equal((await db.query('select * from opportunities')).length, 27);

  // Input parsing.
  assert.equal(cents('45,000.50'), 4500050);
  assert.equal(sfDate('9/12/2026'), '2026-12-09');
  assert.equal(sfDate('9/12/2026', 'mdy'), '2026-09-12');
  assert.equal(sfDate('2026-11-05T22:05:00.000Z'), '2026-11-05');
  assert.throws(() => sfDate('31/02/2026'));
  await fails(['nope'], /Unknown command/);
  await fails(['forecast', '--bogus=1'], /Unknown flag/);
  await fails(['deal', '--deal=tasman'], /More than one deal/);

  // Reads on the demo data.
  assert.ok((await run('help')).length >= 30);
  assert.equal((await run('periods')).length, 3);
  assert.equal((await run('reps')).length, 4);

  const fc = await run('forecast');
  assert.equal(fc.period, 'FY27 Q2');
  assert.equal(fc.total.won_cents, 15300000);
  assert.equal(fc.total.commit_cents, 71100000);
  assert.equal(fc.total.quota_cents, 115000000);
  const dev = fc.rows.find((r) => r.rep === 'Dev Patel');
  assert.equal(Number(dev.call_vs_system_cents), 14200000, 'Dev calls 142k above his system commit');

  assert.equal((await run('pipeline')).rows.length, 11);
  assert.equal((await run('pipeline', '--rep=dev')).rows.length, 3);
  assert.equal((await run('pipeline', '--category=commit')).rows.length, 6);

  const risk = await run('risk');
  assert.equal(risk.rows.length, 4);
  assert.equal(risk.rows[0].deal, 'ERP expansion to three sites');
  assert.equal(risk.rows[0].risk_count, 4);

  const mv = await run('movement');
  assert.equal(mv.rows.length, 7);
  assert.equal(mv.net_cents, 300000);
  assert.deepEqual(mv.rows.map((r) => r.change).sort(), ['increased', 'lost', 'new', 'pulled in', 'pushed out', 'recategorised', 'won']);
  await fails(['movement', `--since=${day(-400)}`], /No snapshot/);

  const sl = await run('slipped');
  assert.equal(sl.rows.length, 3);
  assert.equal(sl.rows[0].pushes, 3);

  const acc = await run('accuracy');
  assert.equal(acc.length, 4);
  assert.equal(Number(acc.find((r) => r.rep === 'Dev Patel').first_call_error_pct), 40);
  assert.equal((await run('accuracy', '--period=FY27 Q1')).length, 4);

  const wi = await run('what-if');
  assert.equal(wi.removed.length, 2);
  assert.equal(wi.reps.reduce((t, r) => t + r.adjusted_commit_cents, 0), 49600000);
  assert.equal((await run('what-if', '--exclude=slippers')).removed.length, 1);
  await fails(['what-if', '--exclude=everything'], /--exclude/);

  assert.equal((await run('calls')).rows.length, 8);
  const callSheet = await run('forecast-call');
  assert.equal(callSheet.rows.length, 4);
  assert.equal(callSheet.rows.find((r) => r.rep === 'Aroha Ngata').inspect.length, 1);

  const att = await run('attention');
  assert.equal(att.rows.length, 9);
  assert.equal(att.rows.filter((r) => r.kind === 'compliance').length, 3);

  const comp = await run('compliance');
  assert.equal(comp.length, 5);
  assert.equal(comp.filter((r) => r.severity === 'breach').length, 3);
  assert.ok(comp.some((r) => r.rule === 'IFRS 15 contract evidence' && r.item === 'Packhouse labour tracking'));
  assert.ok(comp.some((r) => r.rule === 'Published guidance variance' && /-11\.1%/.test(r.issue)));

  const wr = await run('weekly-review');
  assert.equal(wr.movement.rows.length, 7);
  assert.equal(wr.attention.length, 9);

  const d = await run('deal', '--deal=ERP expansion');
  assert.equal(d.history.length, 3);
  assert.equal(d.risks.length, 4);

  // Drafts land in drafts/, never anywhere else.
  const note = await run('draft-forecast-note');
  const noteText = fs.readFileSync(path.join(tmp, note.draft), 'utf8');
  assert.match(noteText, /FY27 Q2 forecast/);
  assert.match(noteText, /Taking out the 2 commit deal/);
  const review = await run('draft-deal-review');
  assert.equal(review.deals, 4);
  assert.match(fs.readFileSync(path.join(tmp, review.draft), 'utf8'), /moved more than once/);

  // Writes.
  const dry = await run('add-rep', '--code=ZZ', '--name=Dry Run', actor, '--dry-run');
  assert.equal(dry.dry_run, true);
  assert.equal((await db.query("select * from reps where code = 'ZZ'")).length, 0, 'dry run leaves nothing behind');
  await run('add-rep', '--code=HT', '--name=Hana Tamaki', '--manager=Mere Walker', '--team=North', actor);
  await run('add-period', '--name=FY27 Q4', `--starts=${day(137)}`, `--ends=${day(227)}`, '--currency=NZD', actor);
  await fails(['add-period', '--name=Overlap', `--starts=${day(130)}`, `--ends=${day(140)}`, '--currency=NZD', actor], /cannot overlap/);
  await run('set-quota', '--period=FY27 Q2', '--rep=Hana', '--amount=100000', actor);
  await run('set-guidance', '--period=FY27 Q2', '--amount=720000', actor);
  assert.equal((await run('compliance')).filter((r) => r.rule === 'Published guidance variance').length, 0, '711k against 720k is inside 5%');
  await run('set-rule', '--key=stale_days', '--value=30', actor);
  assert.equal((await run('risk')).rows.find((r) => r.deal === 'Matter reporting').risks.includes('gone quiet'), false);
  await run('set-rule', '--key=stale_days', '--value=14', actor);
  await fails(['set-rule', '--key=anything', '--value=1', actor], /Rule must be/);

  const added = await run('add-deal', '--name=Rates review', '--account=Kapiti Coast Council', '--rep=HT', '--stage=Qualification', '--amount=42000', `--close=${day(20)}`, actor);
  assert.ok(added.id);
  await run('update-deal', '--deal=Rates review', '--stage=Proposal/Price Quote', '--amount=48000', `--close=${day(35)}`, '--category=best case', `--next-step=Pricing call`, `--next-step-on=${day(3)}`, actor);
  const hist = await db.query("select field from opportunity_history h join opportunities o on o.id = h.opportunity_id where o.name = 'Rates review' order by field");
  assert.deepEqual(hist.map((h) => h.field), ['amount', 'close_date', 'forecast_category', 'stage']);
  await run('update-deal', '--deal=Rates review', '--owner=Aroha', actor);
  assert.equal((await db.query("select new_value from opportunity_history where field = 'owner'"))[0].new_value, 'Aroha Ngata');
  assert.deepEqual((await run('update-deal', '--deal=Rates review', '--amount=48000', actor)).changed, []);
  await run('update-deal', '--deal=Packhouse labour', `--contract-signed=${day(-3)}`, actor);
  assert.equal((await run('compliance')).filter((r) => r.rule === 'IFRS 15 contract evidence').length, 0);

  await run('log', '--deal=Matter reporting', '--note=Partner meeting booked', '--kind=call', actor);
  assert.equal((await run('risk')).rows.find((r) => r.deal === 'Matter reporting').risks.includes('gone quiet'), false);

  await run('call', '--rep=Dev', '--commit=180000', '--best-case=260000', '--note=Waikato out', actor);
  assert.equal(Number((await run('forecast')).rows.find((r) => r.rep === 'Dev Patel').call_commit_cents), 18000000);
  await fails(['call', '--rep=Dev', '--commit=200000', '--best-case=100000', actor], /Best case/);
  await fails(['call', '--period=FY27 Q1', '--rep=Dev', '--commit=1', '--best-case=1', actor], /closed/);
  await assert.rejects(() => db.query('update forecast_calls set commit_cents = 0'), /append only/);

  const snap = await run('snapshot', actor);
  assert.ok(snap.deals >= 12);
  assert.equal((await run('snapshot', actor)).deals, snap.deals, 'a second snapshot the same day replaces the first');

  const fu = await run('followup', '--deal=Rates review', '--note=Check council procurement rules', '--owner=Hana Tamaki', `--due=${day(5)}`, actor);
  assert.ok(fu.id);
  await run('resolve', '--followup=council procurement', '--evidence=Under the direct purchase limit', actor);

  await fails(['close-period', '--period=FY27 Q2', actor], /still has \d+ open deal/);
  await run('close-period', '--period=FY27 Q4', actor);
  await fails(['close-period', '--period=FY27 Q4', actor], /already closed/);

  // Salesforce import: a report export (day-first dates, "Commit") and the OpportunityHistory object.
  const opp = path.join(REPO_ROOT, 'fixtures', 'Opportunity.csv');
  const histFile = path.join(REPO_ROOT, 'fixtures', 'OpportunityHistory.csv');
  const imp = await run('import', 'salesforce', `--file=${opp}`, `--history=${histFile}`, actor);
  assert.deepEqual(
    { added: imp.deals_added, updated: imp.deals_updated, reps: imp.reps_added, stages: imp.stages_added, history: imp.history_rows },
    { added: 2, updated: 1, reps: 1, stages: 1, history: 9 },
  );
  const [harbour] = await db.query("select amount_cents, close_date, forecast_category from opportunities where external_id = '006DEMO0000000001'");
  assert.deepEqual({ ...harbour, amount_cents: Number(harbour.amount_cents) }, { amount_cents: 9000000, close_date: '2026-12-19', forecast_category: 'commit' });
  const [scan] = await db.query("select d.pushes, d.rep, d.stage from v_deals d where d.external_id = '006IMPORT00000001'");
  assert.deepEqual(scan, { pushes: 2, rep: 'Hemi Walker', stage: 'Verbal Agreement' });
  const again = await run('import', 'salesforce', `--file=${opp}`, `--history=${histFile}`, actor);
  assert.equal(again.unchanged, 3, 'importing the same file twice changes nothing');
  assert.equal(again.history_rows, 0);
  await fails(['import', 'hubspot', `--file=${opp}`, actor], /import salesforce/);

  const exp = await run('export');
  assert.equal(exp.counts.opportunities, 30);
  assert.ok(fs.existsSync(path.join(exp.folder, 'forecast_calls.json')));
  assert.ok((await run('activity')).length > 10);

  // Every command ran at least once.
  const missing = Object.keys(commands).filter((c) => !seen.has(c));
  assert.deepEqual(missing, [], `commands not exercised: ${missing.join(', ')}`);

  // The CLI, views and documents run as separate processes too (PGlite only: they share the data folder).
  if (db.mode === 'pglite') {
    await db.close();
    db = null;
    const env = { ...process.env };
    const node = (args) => spawnSync(process.execPath, args, { cwd: REPO_ROOT, env, encoding: 'utf8' });
    let r = node(['scripts/forecast.mjs', 'forecast', '--json']);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).period, 'FY27 Q2');
    r = node(['scripts/forecast.mjs', 'deal', '--deal=nothing-like-this']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /No deal matches/);
    r = node(['scripts/view.mjs']);
    assert.equal(r.status, 0, r.stderr);
    for (const v of ['week', 'slippage', 'accuracy', 'controls']) assert.ok(fs.existsSync(path.join(tmp, 'views', `${v}.html`)), `view ${v}`);
    assert.match(fs.readFileSync(path.join(tmp, 'views', 'week.html'), 'utf8'), /ERP expansion to three sites/);
    r = node(['scripts/docs.mjs']);
    assert.equal(r.status, 0, r.stderr);
    for (const doc of ['forecast-pack', 'deal-review', 'accuracy-report']) assert.ok(fs.readdirSync(path.join(tmp, 'docs-out', doc)).length > 0, `document ${doc}`);
  }

  console.log(`PASS: ${Object.keys(commands).length} commands, ${db ? db.mode : 'pglite'}`);
} finally {
  await db?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

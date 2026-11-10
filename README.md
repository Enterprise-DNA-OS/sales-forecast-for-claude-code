<h1 align="center">Sales Forecast for Claude Code</h1>

<p align="center">
  <strong>The open-source sales forecast that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Salesforce Revenue Intelligence data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=salesforce-revenue-intelligence">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/salesforce-revenue-intelligence?utm_source=github&utm_medium=readme&utm_campaign=salesforce-revenue-intelligence">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-salesforce-revenue-intelligence">Instead of Salesforce Revenue Intelligence</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Sales Forecast for Claude Code does the job you pay Salesforce Revenue Intelligence for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Salesforce Revenue Intelligence dashboard cannot.

**The bill it replaces.** Salesforce lists Revenue Intelligence at AU$308 per user per month, billed annually, on top of a Sales Cloud licence: AU$3,696 a year for every rep and manager who uses it ([Salesforce pricing](https://www.salesforce.com/au/sales/revenue-intelligence/pricing/), checked 10 November 2026). A sales team of twenty pays that twenty times over, every year.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=salesforce-revenue-intelligence).

It runs the weekly forecast for a B2B sales team: quotas by period, each rep's commit and best case call, the roll-up against quota and published guidance, the waterfall of what moved since last week, the deals that keep slipping, and how accurate each rep's call turned out to be. It is for a sales director or revenue operations lead at a 10 to 200 person business who wants a forecast they can trust on Monday morning without paying per seat for the dashboard. It reads your Salesforce opportunities from an export and never writes back.

### Ten questions the dashboard does not answer

Each one is a single command against the demo data today.

1. Which commit deals have had their close date pushed two or more times? `/slipped-deals`
2. How far off was each rep's first call of last quarter, against what they won? `/forecast-accuracy`
3. What moved in the forecast since last Monday, and what was the net change? `/pipeline-waterfall`
4. If every repeat slipper slips again, where does the quarter land? `/what-if` with `--exclude=slippers`
5. Which reps are calling more than their own deals add up to, and by how much? `/forecast`
6. Which open deals has nobody touched in 14 days? `/risk`
7. Is won plus commit still within 5% of the revenue guidance we published? `/compliance`
8. Which Closed Won deals have no signed contract date on file? `/compliance`
9. Which deals changed after we closed last quarter's books? `/compliance`
10. How much open pipeline does each rep have against what they still need to win? `/forecast`

### Three real runs on the demo data

**"What moved in the forecast since last week?"**

```
$ npm run forecast -- movement
FY27 Q2 movement since 2026-11-03: net +$3,000

  change         deal                       rep                  was       now    change  detail
  -------------  -------------------------  --------------  --------  --------  --------  -----------------------------------
  won            Packhouse labour tracking  Dev Patel        $48,000   $48,000        $0  commit to closed
  lost           Visitor insights           Aroha Ngata      $35,000        $0  -$35,000  best case to omitted
  pushed out     Campus services desk       Chloe Liu        $55,000            -$55,000  close date 2026-11-30 to 2027-01-14
  recategorised  Network asset register     Dev Patel       $110,000  $110,000        $0  commit to best case
  pulled in      Grower payments module     Ben Sutherland             $38,000  +$38,000
  new            Workshop scheduling        Dev Patel                  $40,000  +$40,000
  increased      Mill maintenance system    Dev Patel        $55,000   $70,000  +$15,000
```

**"Which deals in this quarter's forecast should I not trust?"**

```
$ npm run forecast -- risk
FY27 Q2: 4 open deal(s) carrying a risk

  deal                          rep             category     amount  close       risks
  ----------------------------  --------------  ---------  --------  ----------  ---------------------------------------------------------------------------------------------------------------------------------------------------
  ERP expansion to three sites  Aroha Ngata     commit     $120,000  2026-11-05  close date passed (5 days ago); gone quiet (last activity 20 days ago); no next step (blank or undated); repeat slipper (close date pushed 3 times)
  Supplier portal               Ben Sutherland  commit      $95,000  2026-12-20  commit at an early stage (Needs Analysis (20%)); next step overdue (Discovery call with ops (due 2026-11-07))
  Matter reporting              Chloe Liu       best case   $45,000  2026-11-25  gone quiet (last activity 16 days ago); no next step (blank or undated)
  Store replenishment pilot     Aroha Ngata     pipeline    $30,000  2026-12-15  gone quiet (last activity 25 days ago); next step overdue (Follow up after trade show (due 2026-10-31))
```

**"How close did each rep's first call come to what they actually won last quarter?"**

```
$ npm run forecast -- accuracy
  period   rep             first call on  first call  last call       won  first call off by  last call off by
  -------  --------------  -------------  ----------  ---------  --------  -----------------  ----------------
  FY27 Q1  Dev Patel       2026-07-04       $280,000   $210,000  $200,000               +40%               +5%
  FY27 Q1  Aroha Ngata     2026-07-04       $300,000   $240,000  $230,000               +30%               +4%
  FY27 Q1  Ben Sutherland  2026-07-04       $200,000   $185,000  $180,000               +11%               +3%
  FY27 Q1  Chloe Liu       2026-07-04       $250,000   $255,000  $260,000                -4%               -2%
```

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/sales-forecast-for-claude-code.git
cd sales-forecast-for-claude-code
npm install
npm run demo
```

`npm run demo` loads a fictional New Zealand software seller (four reps, three quarters, 27 deals) and prints the weekly review. Then open the folder in Claude Code and type `/weekly-review`, or just ask "what moved in the forecast since last week?".

### Your first hour: ten things to ask for

1. "Run the weekly review." (`/weekly-review`)
2. "Run the Monday forecast call, rep by rep." (`/forecast-call`)
3. "Which commit deals should I not trust, and what do I ask about each?" (`/risk`)
4. "What does commit look like without the deals that keep slipping?" (`/what-if`)
5. "Who called high last quarter?" (`/forecast-accuracy`)
6. "Draft this week's forecast note for the leadership team." (`/draft-forecast-note`)
7. "Draft the questions for each rep about their risky deals." (`/draft-deal-review`)
8. "Record Dev's call: 180k commit, 260k best case." (`/submit-call`)
9. "Make a deal quiet after 10 days, not 14." (`/set-rule`)
10. "Add a field for the economic buyer and make commit deals need one." (`/customise`)

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/weekly-review` | The Monday review: forecast, what moved, commit without the risky deals, decisions |
| `/forecast-call` | The forecast call run sheet: each rep's call against their deals, the deals to inspect |
| `/forecast` | Quota, won, commit, best case, pipeline, rep call, gap and coverage per rep |
| `/pipeline` | Open deals in the period, by rep or category |
| `/deal` | One deal: record, every change, activity, follow-ups, risks |
| `/risk` | Open deals with a passed close date, no next step, no activity, repeat pushes or an early-stage commit |
| `/pipeline-waterfall` | What was won, lost, pushed, pulled in, added or changed since last week |
| `/slipped-deals` | Deals whose close date has moved, with the first date given |
| `/forecast-accuracy` | Each rep's first and last call against what they won, per closed period |
| `/what-if` | Commit with the risky deals taken out |
| `/calls` | Every call submitted in the period |
| `/attention` | What needs a decision this week |
| `/compliance` | Contract evidence, guidance variance, forecast policy and closed-period checks, with sources |
| `/submit-call` | Record a rep's commit and best case. Calls are never edited |
| `/add-deal`, `/update-deal`, `/log` | Add a deal, change one (pushes are recorded), log activity |
| `/snapshot` | Save the pipeline as it stands. Run it every Monday |
| `/close-period` | Close a quarter once every deal in it is won, lost or moved |
| `/followup`, `/resolve` | Follow-ups with an owner and a due date |
| `/set-quota`, `/set-guidance`, `/set-rule` | Quotas, published guidance, forecast rules |
| `/add-rep`, `/add-period` | Reps and forecast periods |
| `/import` | Bring deals and their history across from Salesforce |
| `/export` | Every table to JSON |
| `/draft-forecast-note`, `/draft-deal-review` | Drafts to `drafts/`. Nothing is sent |
| `/view`, `/docs` | Branded HTML: the dashboards, the forecast pack, deal review sheets, the accuracy report |
| `/customise`, `/new-view` | Change the schema, a rule or a field in plain words; add a dashboard |
| `/activity`, `/help` | Who changed what; every CLI command |

Every command drives one CLI, `npm run forecast -- <command>`, with `--json` for machines. `npm run view` writes read-only dashboards to `views/`; `npm run docs` writes the forecast pack, deal review sheets and accuracy report to `docs-out/`, in the brand set in `brand.json`.

## Instead of Salesforce Revenue Intelligence

Revenue Intelligence is a layer over your Salesforce opportunities, so switching means exporting those opportunities (a report or Data Loader) and the OpportunityHistory object, then one import:

```bash
npm run forecast -- import salesforce --file=imports/Opportunity.csv --history=imports/OpportunityHistory.csv --actor="Your Name"
```

Every past push and change comes across from the history file. Run it again from a fresh export each week; unchanged deals are left alone. What maps and what does not: [docs/replace-salesforce-revenue-intelligence.md](docs/replace-salesforce-revenue-intelligence.md). The rules behind `/compliance`, with sources: [docs/compliance.md](docs/compliance.md).

## Architecture

```
sales-forecast-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/forecast.mjs      the one CLI the commands drive
  views.json                the dashboards, as SQL
  documents.json            the documents, as SQL
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Sales Forecast for Claude Code for your business, migrates your Salesforce Revenue Intelligence data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=salesforce-revenue-intelligence)
- Read more: [enterprisedna.co/omni/instead-of/salesforce-revenue-intelligence](https://enterprisedna.co/omni/instead-of/salesforce-revenue-intelligence?utm_source=github&utm_medium=readme&utm_campaign=salesforce-revenue-intelligence)

## License

MIT. Copyright (c) 2026 Enterprise DNA.

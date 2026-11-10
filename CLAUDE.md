# Sales Forecast for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| How are we tracking / the weekly review | `/weekly-review` |
| Run the forecast call | `/forecast-call` |
| The numbers by rep | `/forecast` |
| What is in the pipeline | `/pipeline` |
| Tell me about one deal | `/deal` |
| Which deals are at risk | `/risk` |
| What moved since last week | `/pipeline-waterfall` |
| What keeps slipping | `/slipped-deals` |
| Who calls high or low | `/forecast-accuracy` |
| Commit without the risky deals | `/what-if` |
| What has each rep called | `/calls` |
| What needs a decision | `/attention` |
| Are the records clean, are we near guidance | `/compliance` |
| Record a rep's call | `/submit-call` |
| Add, change or log a deal | `/add-deal, /update-deal, /log` |
| Monday snapshot | `/snapshot` |
| Close the quarter | `/close-period` |
| Follow-ups | `/followup, /resolve` |
| Quotas, guidance, rules | `/set-quota, /set-guidance, /set-rule` |
| New rep or period | `/add-rep, /add-period` |
| Bring Salesforce data in | `/import` |
| Take the data out | `/export` |
| Write the weekly note or deal questions | `/draft-forecast-note, /draft-deal-review` |
| A page to look at or print | `/view, /docs, /new-view` |
| Change a field, stage or rule | `/customise` |
| Who changed what | `/activity` |

If an ask fits nothing here, run the CLI directly (`npm run <cli> -- --help`) and then propose a new command for it.

## Forecast house rules

- Commit and best case include what is already won, the way Salesforce rolls them up. Say so when you quote them.
- Always name the period and the currency with a number.
- A rep's call is what they said; the system commit is what their deals add up to. Never blur the two.
- Calls are append only. A changed call is a new call.
- Run `/snapshot` every Monday before the forecast call. The waterfall needs it.
- This reads a Salesforce export. Never write to Salesforce from here.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Salesforce Revenue Intelligence.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/salesforce-revenue-intelligence

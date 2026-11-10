# Moving off Salesforce Revenue Intelligence

Revenue Intelligence reads your Salesforce opportunities and draws dashboards over them. This build reads the same opportunities from an export, keeps them in a database you own, and answers the same questions (and more) by asking. You can run both side by side for a quarter; nothing here writes back to Salesforce.

## 1. Export from Salesforce

You need two files. Either route works.

**Route A: a report (no admin rights needed).**

1. Reports, New Report, *Opportunities*.
2. Filter: Close Date in the periods you want (this quarter, next quarter and last quarter is a good start). Show: All Opportunities.
3. Columns: Opportunity ID, Opportunity Name, Account Name, Opportunity Owner, Stage, Amount Currency (multi-currency orgs), Amount, Probability (%), Close Date, Forecast Category, Next Step, Created Date, Last Activity.
4. Export, *Details Only*, CSV. Save as `imports/Opportunity.csv`.

**Route B: Data Loader or Workbench (admins).** Export the Opportunity object with `Id, Name, Account.Name, Owner.Name, OwnerId, StageName, Amount, CurrencyIsoCode, CloseDate, Probability, ForecastCategoryName, NextStep, CreatedDate, LastActivityDate, IsClosed, IsWon`.

**History, for pushes and past changes.** Export the OpportunityHistory object (Data Loader or Workbench) with `OpportunityId, StageName, Amount, CloseDate, ForecastCategory, CreatedDate`. Each row is a saved version of a deal; the import turns consecutive versions into changes, so every past push of a close date counts from day one. Save as `imports/OpportunityHistory.csv`. Without it, pushes count from the day you switch.

The `imports/` folder is ignored by git, so customer data never lands in the repo.

## 2. Import

```bash
npm run forecast -- import salesforce --file=imports/Opportunity.csv --history=imports/OpportunityHistory.csv --actor="Your Name" --dry-run
npm run forecast -- import salesforce --file=imports/Opportunity.csv --history=imports/OpportunityHistory.csv --actor="Your Name"
npm run forecast -- snapshot --actor="Your Name"
```

Or in Claude Code: `/import`, then `/snapshot`.

Report exports from a New Zealand or Australian locale write dates day first (`19/12/2026`); that is the default. For a US-locale report add `--date-format=mdy`. Data Loader dates are ISO and need nothing.

Run the import again every week (or every day) from a fresh export. Deals are matched on Opportunity ID; a changed stage, amount, close date, category or owner is recorded in the deal's history, and an unchanged deal is left alone.

## 3. Set up the periods, quotas and calls

```bash
npm run forecast -- add-period --name="FY27 Q3" --starts=2026-12-26 --ends=2027-03-26 --currency=NZD --actor="Your Name"
npm run forecast -- set-quota --period="FY27 Q3" --rep="Aroha" --amount=330000 --actor="Your Name"
npm run forecast -- call --rep="Aroha" --commit=250000 --best-case=330000 --actor="Aroha Ngata"
```

## What maps

| Salesforce | Here |
|---|---|
| Opportunity (Id, Name, Account, Owner, Stage, Amount, Close Date, Probability, Forecast Category, Next Step, Created, Last Activity) | `opportunities`, `accounts`, `reps` |
| Opportunity stages (names and default probability) | `stages`. Salesforce's standard stages are pre-loaded; any other stage in your export is added with the probability from the export |
| Forecast categories (Pipeline, Best Case, Commit, Closed, Omitted) | `forecast_category`. The API value `Forecast` maps to Commit |
| Opportunity history | `opportunity_history`, one row per changed field |
| Forecast submissions and adjustments | `forecast_calls`, entered with `/submit-call` from the next call on |
| Quotas (forecast quotas) | `quotas`, entered with `/set-quota` |
| Pipeline trend snapshots | `snapshots`, taken with `/snapshot` from the day you switch |

## What does not carry over

- **Past forecast submissions.** Salesforce Collaborative Forecasts submissions are not in the opportunity export. Enter last quarter's calls with `/submit-call` if you want accuracy measured from the start, or let it build from this quarter.
- **Einstein scores and insights.** These are Salesforce's model outputs. This build gives its own reasons in plain words (`/risk`), from rules you can read and change.
- **Activity detail.** Last Activity carries across as a date. Emails and meetings stay in Salesforce; log new ones here with `/log` or keep them there.
- **Dashboards.** Replaced by asking, by `npm run view`, and by `npm run docs`.

Want it set up, with the export running on a schedule and your stages and rules already in? Enterprise DNA does that: https://enterprisedna.co/omni/instead-of/salesforce-revenue-intelligence

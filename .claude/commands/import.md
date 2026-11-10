---
description: Bring deals across from Salesforce: an opportunity report or Data Loader export, plus the OpportunityHistory export for every past push and change.
---

Read docs/replace-salesforce-revenue-intelligence.md first. Run with --dry-run, show the counts (added, updated, unchanged, reps, stages, history rows), and import for real once the operator says yes. Dates in a New Zealand or Australian report are day first; a US-locale export needs --date-format=mdy. After the import, run /snapshot so next week's waterfall has a starting point. Importing the same file again changes nothing.

```bash
npm run forecast -- import salesforce --file=imports/Opportunity.csv --history=imports/OpportunityHistory.csv --actor="Mere Walker" --dry-run
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

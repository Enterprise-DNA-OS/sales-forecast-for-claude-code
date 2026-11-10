---
description: What moved in the forecast since last week (or a date): won, lost, pushed out, pulled in, new, increased, decreased, recategorised.
---

Run movement. Lead with the net change in the period's currency, then group the rows: good news (won, pulled in, new, increased), bad news (lost, pushed out, decreased, downgraded). Name the rep on each. It compares against the last snapshot taken on or before the date, so if there is none, say to run /snapshot every Monday.

```bash
npm run forecast -- movement
npm run forecast -- movement --since=2026-11-01
```

Every command accepts `--json`. Read the result before you answer; never answer about the records from memory. Nothing here writes to Salesforce or sends a message.

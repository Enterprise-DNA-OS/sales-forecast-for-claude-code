---
description: The forecast roll-up for the current period: quota, won, commit, best case, open pipeline, each rep's call and the gap to quota.
---

Run the roll-up. Lead with one line: won so far, commit, best case and the gap to quota for the team, in the period's currency. Then the rep table. Call out any rep whose call sits more than 20% above or below their system commit, and any rep with coverage under 3x.

```bash
npm run forecast -- forecast
npm run forecast -- forecast --period="FY27 Q3"
```

Every command accepts `--json`. Read the result before you answer; never answer about the records from memory. Nothing here writes to Salesforce or sends a message.

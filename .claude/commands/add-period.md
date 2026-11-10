---
description: Add a forecast period (usually a quarter). Periods cannot overlap.
---

Collect the name, start, end and currency, and the published guidance if there is one.

```bash
npm run forecast -- add-period --name="FY27 Q4" --starts=2027-03-27 --ends=2027-06-25 --currency=NZD --actor="Mere Walker"
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

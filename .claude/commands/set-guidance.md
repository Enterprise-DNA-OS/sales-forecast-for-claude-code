---
description: Record the revenue guidance published to the market or the board for a period, so /compliance can check the forecast against it.
---

Confirm the period and the figure, and where it was published.

```bash
npm run forecast -- set-guidance --period="FY27 Q2" --amount=800000 --actor="Mere Walker" --dry-run
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

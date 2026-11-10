---
description: Change a deal's stage, amount, close date, category, owner, next step or contract date. Forecast fields go into the deal's history.
---

Find the deal, show its current values, and change only what the operator named. A moved close date is a push; say so.

```bash
npm run forecast -- update-deal --deal="Tasman Foods" --close=2026-12-12 --category=best_case --actor="Mere Walker" --dry-run
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

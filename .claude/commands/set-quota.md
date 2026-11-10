---
description: Set a rep's quota for a period.
---

Confirm the rep, the period and the amount in the period's currency.

```bash
npm run forecast -- set-quota --period="FY27 Q3" --rep=AN --amount=330000 --actor="Mere Walker" --dry-run
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

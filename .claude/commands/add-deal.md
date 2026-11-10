---
description: Add a deal that is not in Salesforce yet.
---

Collect the name, account, rep, stage, amount and close date. Default the category from the stage unless the operator gives one.

```bash
npm run forecast -- add-deal --name="Rates review" --account="Kapiti Coast Council" --rep=HT --stage=Qualification --amount=42000 --close=2026-12-15 --actor="Mere Walker" --dry-run
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

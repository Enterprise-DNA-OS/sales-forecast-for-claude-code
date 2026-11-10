---
description: Close a period once every deal in it is won, lost or moved. Accuracy is measured on closed periods.
---

Run it. If deals are still open, list them and stop: each needs winning, losing or a new close date first. Changes to a closed period's deals show up in /compliance afterwards.

```bash
npm run forecast -- close-period --period="FY27 Q2" --actor="Mere Walker" --dry-run
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

---
description: Close a follow-up with the evidence that it was done.
---

Find the open follow-up and record what was done.

```bash
npm run forecast -- resolve --followup="close plan" --evidence="Plan received, signing 12 Dec" --actor="Mere Walker"
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

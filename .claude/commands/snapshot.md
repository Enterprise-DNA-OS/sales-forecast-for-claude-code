---
description: Save the open pipeline as it stands today. Run it every Monday before the forecast call; the waterfall compares against it.
---

Run it and report how many deals were captured. A second run on the same day replaces that day's snapshot.

```bash
npm run forecast -- snapshot --actor="Mere Walker"
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

---
description: Add a rep.
---

Collect a short code, the full name, manager and team.

```bash
npm run forecast -- add-rep --code=HT --name="Hana Tamaki" --manager="Mere Walker" --team=North --actor="Mere Walker"
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

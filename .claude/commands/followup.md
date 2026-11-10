---
description: Add a follow-up with an owner and a due date, on a deal or on its own.
---

Collect the note, owner and due date.

```bash
npm run forecast -- followup --deal="Tasman Foods" --note="Get a dated close plan" --owner="Mere Walker" --due=2026-11-14 --actor="Mere Walker"
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

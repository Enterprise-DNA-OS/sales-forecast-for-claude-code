---
description: Record a rep's forecast call for the period: commit and best case, with a note.
---

Confirm the rep, the period and both numbers before writing. Calls are never edited; a changed call is a new row, so the history of what was said stays.

```bash
npm run forecast -- call --rep="Dev" --commit=180000 --best-case=260000 --note="Waikato out" --actor="Mere Walker" --dry-run
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

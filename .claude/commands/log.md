---
description: Log a call, meeting or note against a deal. Updates when it was last touched.
---

Find the deal and log the note in the operator's words.

```bash
npm run forecast -- log --deal="Matter reporting" --kind=call --note="Partner meeting booked" --actor="Chloe Liu"
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

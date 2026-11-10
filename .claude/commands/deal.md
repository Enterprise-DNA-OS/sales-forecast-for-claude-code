---
description: Everything about one deal: the record, every change to stage, amount, close date and category, activity, follow-ups and risks.
---

Find the deal by name, account or Salesforce id. If more than one matches, show the candidates and ask. Summarise in three lines: where it stands, what has changed and how often it has moved, and what would have to happen for it to close on its date.

```bash
npm run forecast -- deal --deal="Tasman Foods ERP"
```

Every command accepts `--json`. Read the result before you answer; never answer about the records from memory. Nothing here writes to Salesforce or sends a message.

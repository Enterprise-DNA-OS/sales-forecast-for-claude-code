---
description: Open deals in the period, filtered by rep or forecast category if asked.
---

List the open deals, biggest first. If the operator names a rep or a category (commit, best case, pipeline), filter by it.

```bash
npm run forecast -- pipeline
npm run forecast -- pipeline --rep="Dev" --category=commit
```

Every command accepts `--json`. Read the result before you answer; never answer about the records from memory. Nothing here writes to Salesforce or sends a message.

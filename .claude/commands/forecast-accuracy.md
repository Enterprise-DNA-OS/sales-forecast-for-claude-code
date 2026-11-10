---
description: How close each rep's first and last call came to what they won, for closed periods.
---

Run accuracy. Say who calls high, who calls low, and by how much on the first call of the period. Use it to weight this period's calls: a rep who called 40% high last quarter gets their commit read with that in mind.

```bash
npm run forecast -- accuracy
npm run forecast -- accuracy --period="FY27 Q1"
```

Every command accepts `--json`. Read the result before you answer; never answer about the records from memory. Nothing here writes to Salesforce or sends a message.

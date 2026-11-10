---
description: The Monday review written from the forecast, the waterfall, the what-if and the attention list.
---

Run weekly-review. Write five short paragraphs: where the quarter stands against quota and guidance; what moved since last week and why; which commit deals are at risk and what commit looks like without them; whose calls do not match their deals (use /forecast-accuracy for history); the three decisions for this week.

```bash
npm run forecast -- weekly-review
```

Every command accepts `--json`. Read the result before you answer; never answer about the records from memory. Nothing here writes to Salesforce or sends a message.

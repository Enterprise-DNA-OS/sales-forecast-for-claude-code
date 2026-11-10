---
description: Render the paperwork: the forecast pack for each open period, a deal review sheet for each risky deal, and the accuracy report for each closed period.
---

Run it and give the operator the file paths in docs-out/. They print to PDF from a browser.

```bash
npm run docs
npm run docs -- forecast-pack
```

Every command accepts `--json`. Read the result before you answer; never answer about the records from memory. Nothing here writes to Salesforce or sends a message.

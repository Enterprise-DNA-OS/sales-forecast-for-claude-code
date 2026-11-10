---
description: Change a forecast rule: stale_days, commit_min_probability, push_limit, guidance_review_pct, guidance_material_pct.
---

Say what the rule is now and what it will be, then change it. Rules are whole numbers.

```bash
npm run forecast -- set-rule --key=stale_days --value=10 --actor="Mere Walker" --dry-run
```

Writes need `--actor=<the operator's name>`. Run once with `--dry-run` and show what would change, then run it for real once the operator says yes. Nothing here writes to Salesforce or sends a message.

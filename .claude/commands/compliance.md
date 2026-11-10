---
description: Check the deals and the forecast against the rules in docs/compliance.md (contract evidence, published guidance, forecast policy, closed periods) and report what is breached, with the source.
---

1. Run the checks.

```bash
npm run forecast -- compliance
```

2. Read `docs/compliance.md` for the source behind each rule and how to read it.
3. Report as a table: severity, rule, the deal or period, the issue, the source. Breaches first, then reviews.
4. For anything breached, draft the fix the operator can approve: the deal to update (a contract date, a category, a close date), the guidance question for the board, or a follow-up to add. Draft to `drafts/`, never send.
5. If a rule in `docs/compliance.md` is out of date, say so and stop. Do not guess at law or accounting standards. The operator confirms the rule, then you update the doc and the check together.

Nothing here is legal or accounting advice. The checks flag records for a person to look at.

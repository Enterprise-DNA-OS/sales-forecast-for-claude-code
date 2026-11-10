# Forecast controls and the rules behind them

Checked 10 November 2026. `/compliance` (`npm run forecast -- compliance`) and the `v_compliance` view run every check below. They flag records for a person to look at. They do not decide whether a business complies with the law or an accounting standard, and nothing here is legal or accounting advice.

| Check | What it flags | Source | Severity |
|---|---|---|---|
| IFRS 15 contract evidence | A deal marked Closed Won with no `contract_signed_on` date | [IFRS 15 *Revenue from Contracts with Customers*](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/), paragraph 9, adopted in New Zealand as NZ IFRS 15 and in Australia as AASB 15. A contract exists for revenue purposes only when the parties have approved it and are committed, each party's rights and the payment terms can be identified, it has commercial substance, and collection is probable. | breach |
| Published guidance variance | Won plus commit for an open period sits more than 5% from the revenue guidance recorded with `/set-guidance` | [ASX Listing Rule 3.1](https://www.asx.com.au/about/regulation/rules-guidance-notes-and-waivers/asx-listing-rules-guidance-notes-and-waivers) and [Guidance Note 8](https://www.asx.com.au/documents/rules/gn08_continuous_disclosure.pdf), section 7.3: a variation from an entity's own published guidance of 10% or more is presumed material, 5% or less presumed not material, and between the two is a judgement. NZX Listing Rule 3.1 ([NZX regulation](https://www.nzx.com/regulation)) carries the same continuous disclosure duty in New Zealand. | breach at 10% or more, review between 5% and 10% |
| Forecast policy: commit stage | A Commit deal at a stage below `commit_min_probability` (default 50%) | Your own forecast policy. Change it with `/set-rule`. | review |
| Forecast policy: commit next step | A Commit deal with no dated next step | Your own forecast policy. | review |
| Closed period changed | A stage, amount, close date, category or owner change dated after the period it belongs to was closed | Your own period close control: once a quarter is reported, its deals should not move without someone knowing. | breach |
| Currency mismatch | A deal in a different currency from its period, which the roll-up leaves out | Data quality. Convert it or split it. | review |

## How to read them

- **IFRS 15 contract evidence.** Paragraph 9 accepts approval "in writing, orally or in accordance with other customary business practices", so a missing date is missing evidence, not proof there is no contract. The check exists because a Closed Won that finance cannot match to a contract becomes revenue that does not arrive. Record the date with `/update-deal --contract-signed=YYYY-MM-DD`.
- **Published guidance variance.** Guidance Note 8 measures variance against an entity's own published earnings guidance. This build compares the revenue forecast with whatever revenue figure you record with `/set-guidance`. A revenue miss is an early sign, not the test itself: whether an update to the market is needed is a judgement for the board and its advisers. The thresholds are `guidance_review_pct` and `guidance_material_pct`; ASX suggests a figure closer to 5% for entities in the ASX 300 or with very stable earnings.
- **Policy checks.** These are the business's own rules about what can sit in commit. They are on by default because they are the rules most sales leaders already state and few check.

## Changing a rule

Ask `/customise` to add a check, or `/set-rule` to change a threshold. When a rule above goes out of date, update this file and the check in the same change, with the new source and the date you checked it.

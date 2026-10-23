# KPI scorecard

**Status of this scorecard: CREATED 2026-10-23.** Owner: Gleicimar.

Every value is **NOT MEASURED**. No analytics export, database count, or production log was read to fill this file. A blank is not a zero. Do not copy a number into the value column until the window, the source, and the guardrail below are the ones that were actually used.

Event names in the definitions are the ones in `lib/analytics/events.ts`. If a definition needs a column the product does not write, the value stays **NOT MEASURED** and the gap stays in the guardrail.

| KPI | Definition | Window | Guardrail | Value |
|---|---|---|---|---|
| Signups | Count of `signup` events. | Trailing 7 days, UTC. | Do not add anonymous sessions that never reached `signup`. | NOT MEASURED |
| Age gate | Share of `signup` events in the window that have `age_verified` true afterward. Numerator and denominator reported separately. | Trailing 7 days, UTC. | `local` approvals do not count. Do not store a birthdate or a document number to compute this. | NOT MEASURED |
| Location publications | Count of location rows whose public position is newer than 24 hours. | One snapshot per day, UTC. | The snapshot uses `public_geo` freshness only. Do not put `true_geo` in a dashboard, export, or alert. | NOT MEASURED |
| Offset floor | Minimum haversine distance between `true_geo` and `public_geo` for publications in the window. | Trailing 24 hours. Server-side only. | A result under 250 m is a defect, not a target to tune in public. Do not log the pairs. Until a server-side check exists, this stays **NOT MEASURED** even after the unit test is green. | NOT MEASURED |
| Reports filed | Count of `reports` inserts, split by stored reason string (not by the admin severity chip). | Trailing 24 hours and trailing 7 days. | `underage` and `Underage` are both critical. The chip follows `REASON_SEVERITY`. Critical includes `underage`, `csam`, `threats`, `stalking`, `sextortion`, `ncii`, and the public labels `Underage`, `Shared my photos`, and `Illegal content`. Unknown strings are Low. | NOT MEASURED |
| Safety first response | Share of safety-reason reports whose first `mod_actions` row or first non-open status is within 4 hours of `created_at`. Other reasons: 24 hours. Report the count that had no response. | Trailing 7 days. | For a reason in `REASON_SEVERITY`, the admin chip matches that rank (critical is the 4-hour clock). Unknown strings are Low, so a string the map does not list still needs a person to assign the clock. There is no dedicated first-touch column; if the query cannot see one, leave this **NOT MEASURED** rather than using a proxy. | NOT MEASURED |
| Blocks | Count of `blocks` inserts. | Trailing 7 days. | Do not join to `true_geo`. A block is not a report. | NOT MEASURED |
| Appeals older than 72 hours | Count of `appeals` in `pending` whose `created_at` is older than 72 hours. | Snapshot. | Member intake does not exist, so a zero would not mean the promise on `/help/appeals` is kept. Do not publish an SLA met rate. | NOT MEASURED |
| New charges | Count of `subscribed` and of checkout responses that are not the billing-disabled 503. | Trailing 7 days. | Any new charge while the owner decision is "no charging" is an incident. `subscribe_started` is an attempt, not revenue. | NOT MEASURED |
| Account exit | Count of `account_deleted` and of `data_exported`. | Trailing 28 days. | Export must not include a true position. The export route already omits location; do not add it to "improve" this KPI. | NOT MEASURED |
| Alert delivery | Count of `opsAlert` calls that returned a delivered email or webhook, versus calls that only logged. | Trailing 7 days. | The product does not persist this count today. Until it does, the value is **NOT MEASURED**. Do not scrape server logs into a sheet that contains report text. | NOT MEASURED |

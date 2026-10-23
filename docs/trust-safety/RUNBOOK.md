# Trust & Safety runbook

**Status: CREATED 2026-10-23. Operational draft. Not legal advice. Not a drill.**

Owner: Gleicimar. Location privacy is the annulus merged in PR #51. This branch adds the severity map in `lib/safety/reasons.ts` and the underage protective hold. It describes that code. Where a section is marked **counsel review required**, counsel has to confirm it before anyone treats it as the company's obligation or as permission to act.

Nothing here was checked against a live queue, a production database, or an on-call rotation.

Related: `docs/GO_LIVE.md` §4 (member appeals still static), `docs/registers/LAUNCH_GATES.md` (PRK-009), `docs/legal-review/` (draft, not approved).

## 1. How a report arrives

Two writers insert into `reports`. Neither path sets `users.mod_step` to `suspended` or deletes the account. An in-app report whose stored reason is exactly `underage`, filed by an age-verified member, applies a reversible protective hold (section 6) once migration `20261023190000_051_underage_protective_hold.sql` is applied. Every other reason only files the report and sends the alert.

| Path | Who | Route | What is stored |
|---|---|---|---|
| In the product | Signed-in member | `POST /api/safety/report` | `target_id`, reason enum, optional `details` (max 2,000 characters), optional `evidence.conversationId`, `reporter_ip` when a client IP header exists, `status: open` |
| Public form | Anyone, account optional | `POST /api/help/report` | Public label mapped to a queue reason, the story in `details`, `evidence.source = public_form` plus link, contact email, and `urgent`, `reporter_ip`, `target_id` null until a person identifies the member |

In-app reasons (`lib/safety/reasons.ts`, used by `POST /api/safety/report` and the chat safety menu): `underage`, `csam`, `threats`, `stalking`, `sextortion`, `ncii`, `harassment`, `hate`, `unsafe`, `spam`, `impersonation`, `other`. A member cannot report their own id. More than 10 reports from the same account in an hour returns 429. The route writes `audit_log` action `report.filed` and calls `opsAlert`. When the underage hold runs, it writes its own audit rows (section 6).

Public labels (`app/api/help/report/route.ts`): "Someone under 18", "Shared without consent", "Impersonation", "Harassment or threats", "Hate or discrimination", "Scam or spam", "Illegal content", "Other". Five reports per IP per hour. `urgent` is set only for under-18 and non-consensual sharing. If the database is missing or the insert fails, the route returns 503 and does not claim the report was received. The id in a successful response is the row id.

The chat safety menu (`components/chat/safety-menu.tsx`) calls the in-app route. It tells the member that messages stay encrypted and that only the text they type is shared. Sending a report does not block. Blocking is a separate button.

Alerts (`lib/alerts/server.ts`, merged PR #50) go to `OPS_ALERT_EMAIL` through Resend, to `OPS_WEBHOOK_URL`, or to both. The body is built only by `reportAlertText` in `lib/safety/reasons.ts`: type, severity, id, and an admin link. Coordinates, chat, document numbers, and the report story are not parameters of that function. The same alert is not sent again for five minutes on that server instance. If neither channel is set, the alert is a server log line. As of 2026-10-23 18:40 UTC the alerts code was deployed and `OPS_ALERT_EMAIL` was not visible in production, so do not assume an inbox is receiving these.

## 2. Severity chips and the SLA the console shows

`/admin/reports` header: "Highest severity first · SLA: safety 4h, other 24h". The home queue uses the same split (`app/admin/page.tsx`).

The chip comes from `REASON_SEVERITY` in `lib/safety/reasons.ts`, re-exported as `SEV` from `lib/admin/ts-seed.ts`. The key is the **stored reason string**. Rank 3 is labelled Critical and is the 4-hour safety clock. Rank 2 (Medium) and rank 1 (Low) share the 24-hour clock. A string that is not in the map is Low. The full write-up of the choices is `docs/trust-safety/REPORT_SEVERITY.md`.

| Stored reason | Where it is written | Chip | How to triage |
|---|---|---|---|
| `underage` | In-app | Critical (3) | Safety. Immediate. Protective hold when the reporter is age-verified and migration 051 is applied. Section 6. |
| `Underage` | Public form | Critical (3) | Safety. Immediate. No `target_id`, so no automatic hold. Section 6. |
| `csam` | In-app | Critical (3) | 4h. Sexual material of a minor. No automatic hold. Section 7. |
| `Illegal content` | Public form | Critical (3) | 4h. If it describes sexual material of a minor, stop and use section 7. No automatic hold. |
| `threats` | In-app | Critical (3) | 4h. No automatic hold. Section 8. |
| `Threats or violence` | Older demo queue | Critical (3) | Same clock as `threats`. |
| `stalking` | In-app | Critical (3) | 4h. Stalking, doxxing, or location exposure. No automatic hold. Section 8. |
| `sextortion` | In-app | Critical (3) | 4h. Coercion or sextortion. No automatic hold. Section 8. |
| `ncii` | In-app | Critical (3) | 4h. Intimate images shared without consent. No automatic hold. Do not re-host the image. |
| `Shared my photos` | Public form | Critical (3) | 4h. Non-consensual imagery. Do not re-host the image. |
| `harassment` | In-app | Medium (2) | 24h. Upgrade when the text is a threat, stalking, or coercion. Those have their own critical slugs. |
| `Harassment` | Public form | Medium (2) | The public label is "Harassment or threats" and still stores `Harassment`. Read it before leaving it on the 24h clock. |
| `hate` | In-app | Medium (2) | 24h. |
| `Hate or discrimination` | Public form | Medium (2) | 24h. |
| `unsafe` | In-app | Medium (2) | 24h unless the text is a threat, stalking, or coercion. |
| `spam`, `Scam or spam` | In-app / public | Low (1) | 24h, unless money has already moved. Section 9. |
| `impersonation`, `Fake or impersonation` | In-app / public | Low (1) | 24h. Section 9 if they are pretending to be the company. |
| `other`, `Other` | Either | Low (1) | Read the text before assigning a clock. |

Sort in the console is `compareReportQueue`: critical first, then **newest** first inside the same rank. `GET /api/admin/reports` uses the same order. An older Critical report can sit under a newer one with the same rank. Scan the whole open Critical band, not only the top row.

There is no `under_review` button on the page. The API accepts `open`, `under_review`, `resolved`, `dismissed`. Closing a report (`resolved` or `dismissed`) sets `resolved_at`, `resolved_by`, and **clears `reporter_ip`**.

Demo rows (`lib/admin/ts-seed.ts`) are empty when `NODE_ENV` is production. If `/api/admin/reports` fails, the page still switches to that seed and, in production, shows an empty list with the demo flag. An empty demo queue means the load failed. It does not mean there are no reports.

## 3. Working a report

1. Open `/admin/reports` as an admin (`ADMIN_EMAILS`; `requireAdmin`).
2. Read the reason string, not only the chip. Apply section 2.
3. Under-18 and anything that might be sexual material of a minor: leave the rest of the queue and follow sections 6 and 7.
4. Dismiss only when the report is spam, a duplicate, or does not describe a rule break. `PATCH /api/admin/reports` with `dismissed`.
5. Otherwise act from the report (`POST /api/admin/mod-action`) so the report id is included. That call marks the report resolved. The note you type is stored as the mod-action reason. The product does not send that note to the member by itself.
6. Write the audit row by using these routes. Do not edit `users.mod_step` in the database by hand.

## 4. Block

`POST /api/safety/block` upserts `blocks` (duplicate ignored) and writes `audit_log` `block.add`. `DELETE` removes that pair. `GET` returns the blocker's list (id, handle, time) and nobody else's.

A block is not a report. A report does not create a block.

What the code does with a block, in either direction:

- `nearby_users` hides the pair (`lib/db/migrations/030_presence_heartbeat.sql`).
- `trips_near_v2` hides the pair.
- `POST /api/chat/start` returns 403 `Not available`.

The blocked member is not notified. The route does not return either person's coordinates.

## 5. Moderation ladder

`POST /api/admin/mod-action`. You cannot moderate your own user id. Steps:

| Button | `users.mod_step` | Also |
|---|---|---|
| Warn | `warning` | Auth ban cleared (`ban_duration: none`). No visibility change. |
| Limit 7d | `limited` | `mod_actions.expires_at` is set 7 days out. Auth ban cleared. **No route reads `limited` or `expires_at`.** Chat start, nearby, and messaging do not pause. The help page says messaging new people is paused for 7 days. That sentence is ahead of the code. |
| Suspend 30d | `suspended` | `visibility` hidden. Auth ban `720h`. Hidden from nearby and from profile reads that already exclude `suspended` / `removed`. |
| Remove | `removed` | `deleted_at` set, `visibility` hidden, auth ban `876000h`. |

If the auth ban call fails, the route logs it and still returns success after the row updates. Confirm the member can no longer sign in; do not assume the ban landed.

## 6. Under-18 reports

**Do this immediately, then a second person reviews.**

### In-app `underage` (there is a `target_id`)

When the reporter's session is age-verified (`session.ageVerified`), the route applies a protective hold after the report insert:

- `users.visibility` becomes `hidden` and `users.safety_hold_at` is set. Map, nearby, and hotspot queries already skip hidden members. Search drops ids with `safety_hold_at`. Other members' profile reads return 404. A member who only chose hidden themselves is still searchable.
- New direct messages, new interests (matches), meet proposals, and new group, area, and place messages are refused while the hold is on. Existing rows are not deleted.
- Require ID: auth `app_metadata.age_verified` false, `age_recheck` true, `age_method` null. Same flag as Admin → Users → Require ID. It is not an auth ban. The hold does not set `mod_step`, `deleted_at`, or `ban_duration`.
- Audit: `safety.hold_applied`, with the report id and the previous visibility and 18+ flags. No narrative and no coordinates.

The hold is reversible. Release it from Admin → Users → **Release hold** (`POST /api/admin/users/{id}/safety-hold`). Release restores the saved visibility and, when this hold wrote Require ID, restores the previous 18+ flag.

Limits, so a report cannot be used as a ban:

- Only the exact slug `underage`. `csam`, public `Underage`, and every other reason do not hold.
- The reporter must already be age-verified. Middleware already returns 403 on `/api/safety/report` until the 18+ gate. An unverified reporter still files a critical report and the alert still fires; a person applies the hold. Photo verification or a minimum account age was not added: that delay would leave a reported minor visible when the only witness is new. The age gate and the cap below are the brakes.
- Cap: 2 holds per reporter per 24 hours, counted from `safety.hold_applied`. Further underage reports from that account still file and still alert.
- A target already on hold is not written again, so the saved previous visibility is not overwritten.
- If the previous 18+ flag cannot be read, the account is still hidden and Require ID is left for a person (`safety.hold_require_id_failed`). Release will not guess that the account was verified.

Migration `supabase/migrations/20261023190000_051_underage_protective_hold.sql` adds the columns and a check that a held row stays `visibility = hidden`. **It is not applied by this change.** The owner runs it in Supabase. Until then the route audits `safety.hold_schema_pending`, the report is still stored, and the critical alert still fires. While the schema is missing, do both human steps in the public-form list below (suspend and Require ID). Those two steps are not substitutes for each other. The hold is not a substitute for them, and it is not a ban.

### Public form `Underage` (no `target_id`)

1. Identify the account from the link or the story. Do not suspend a guess.
2. On that user, do **both**:
   - Suspend (`POST /api/admin/mod-action`, step `suspend`), with the report id attached.
   - Require an ID check (`POST /api/admin/users/{id}/age-recheck`, or Admin → Users → **Require ID**). That route sets auth `app_metadata.age_verified` false and `age_recheck` true. Middleware then answers 403 on gated APIs until a verification provider approves them again. It does not set `mod_step` and it does not ban the auth user. Suspend and Require ID are not substitutes.
3. Leave the report open until the second reviewer has looked, if you had to act from the user page without the report id. If you used mod-action with the report id, the report is already marked resolved; the second reviewer uses `audit_log` and the user row.
4. Do not ask the reporter or the member to email a photograph of an identity document or of a minor.

`/api/admin/users/{id}/age-recheck` refuses to target the caller.

## 7. Sexual material involving a minor

> **Counsel review required.** This is a preservation and escalation note for staff. It is not legal advice, not a determination that a report is CSAM, and not the company's CyberTipline procedure. Counsel has to approve who files, what may be included, and how long objects are kept before this section is used as policy.

In-app `csam` and public `Illegal content` are Critical. Neither applies the protective hold. The hold in section 6 is not a substitute for this section, and it is not a substitute for counsel or for an NCMEC filing.

When a report may involve child sexual abuse material:

- Do not download, open, screenshot, forward, or copy the material. Do not ask the reporter to send a copy to email, Slack, or a phone.
- Do not put the story into a new message. The alert is a pointer (type, severity, id, and admin link). The story stays on the report row. Do not forward even the pointer into a personal channel.
- Leave the `reports` row, its `evidence`, and any objects already in storage in place. Do not delete the account or the objects until counsel says preservation is satisfied. The section 6 hold hides the account and flags Require ID; it does not set `mod_step` and it does not delete stored objects. Suspension is still a human step so the account cannot keep using the product; suspension hides and bans, it does not delete stored objects (`Remove` does set `deleted_at` — do not Remove until counsel has said so).
- Counsel directs the report to the National Center for Missing & Exploited Children (NCMEC) CyberTipline. 18 U.S.C. § 2258A is the statute counsel will read. Staff do not freelance a filing from this runbook.
- Tell counsel the same day the report is seen.

## 8. Stalking, coercion, threats

In-app `threats`, `stalking`, and `sextortion` are Critical (4 hour clock). They do not apply a protective hold and they do not suspend. Public "Harassment or threats" is stored as `Harassment` (Medium). In-app `harassment` and `unsafe` are Medium; upgrade them when the text is a threat, stalking, or coercion.

Treat the text as the 4 hour clock when it describes a threat, someone being followed, or pressure to meet or to send images.

- The member can block (section 4). Say that. Do not promise that a block moves the other person or reveals where they are.
- Suspend when the threat is specific or the member says they are afraid now.
- Do not give either person the other's true coordinates, the fuzz seed, or a distance computed from `true_geo`. Map pins are the fuzzed public point only.
- The product has no separate emergency dispatch. Help copy tells members to contact local emergency services first. Staff do not replace that.

## 9. Fraud and impersonation

`spam`, `Scam or spam`, `impersonation`, `Fake or impersonation`.

- 24 hour clock unless the member has already paid someone or the account is impersonating the company.
- Do not tell the reporter to pay a fee, send a gift card, or move the conversation off the product to "recover" an account.
- New Plus/Premium checkout is off in code unless `BILLING_ENABLED` is exactly `true` (merged PR #49). This runbook does not know whether that variable is set in Vercel. Do not turn it on while working a fraud report.
- Existing subscription changes still go through PayPal webhooks. A fraud report is not a refund tool.

## 10. Law-enforcement and legal requests

> **Counsel review required.** Not legal advice. The draft in `docs/legal-review/piroka-legal-center-v1.0.md` is not an approved policy.

There is no legal-request queue, no preservation-hold flag, and no member-notification switch.

- Do not export an account, read `true_geo`, or copy message ciphertext because a request arrived by email or chat.
- Keep the request: who sent it, the agency, the date, what they asked for, and any deadline they stated. Store that note where counsel tells you to, not in the report narrative and not in an ops alert.
- Counsel decides whether anything is produced and whether the member may be told.

## 11. Appeals

Member screen `/help/appeals` (`components/help/account-standing.tsx`) always renders **Good standing** and a static ladder. The file says the standing backend has not landed. There is no member route that inserts into `appeals`.

`GET` and `PATCH /api/admin/appeals` list and update rows (`pending`, `granted`, `denied`) and write `audit_log`. Nothing in the repository inserts an appeal. `granted` does not clear `mod_step`, the auth ban, or `visibility`.

The table comment says the reviewer must not be the original moderator. No trigger enforces it. `PATCH` stores `reviewer_id` and does not compare it to the moderator who wrote the action.

The help page says a different moderator replies within 72 hours. That clock is not implemented. Do not tell a member it has started. This is the gap `docs/GO_LIVE.md` §4 recorded for the member screen; the admin update route does not close it.

## 12. Evidence and privacy rules for staff

- Direct messages are stored as ciphertext. A report does not decrypt them. The only message content moderators see is what the reporter typed into `details`.
- `reporter_ip` is for spotting repeat or abusive reporters. It is removed when the report is closed. Do not copy it into a ticket that outlives the report.
- Do not request or attach health-card contents. Those payloads are separate and encrypted.
- Do not put true coordinates, document numbers, or the report story into Slack, email, or analytics. The product redacts those from ops alerts. Do not add a second copy of the report text anywhere else.
- Photos stay behind the routes that mint signed URLs. Do not make a bucket public to "get a look", and do not download a private album into a chat.
- Account export (`/api/me/export`) is the member's own data. It is not the evidence bundle for a report.

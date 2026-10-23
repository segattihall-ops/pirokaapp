# Trust & Safety runbook

**Status: CREATED 2026-10-23. Operational draft. Not legal advice. Not a drill.**

Owner: Gleicimar. Written from the code on `main` (plus the location-privacy change in this branch). It describes what the product does today. Where a section is marked **counsel review required**, counsel has to confirm it before anyone treats it as the company's obligation or as permission to act.

Nothing here was checked against a live queue, a production database, or an on-call rotation.

Related: `docs/GO_LIVE.md` §4 (member appeals still static), `docs/registers/LAUNCH_GATES.md` (PRK-009), `docs/legal-review/` (draft, not approved).

## 1. How a report arrives

Two writers insert into `reports`. Neither one suspends the reported member.

| Path | Who | Route | What is stored |
|---|---|---|---|
| In the product | Signed-in member | `POST /api/safety/report` | `target_id`, reason enum, optional `details` (max 2,000 characters), optional `evidence.conversationId`, `reporter_ip` when a client IP header exists, `status: open` |
| Public form | Anyone, account optional | `POST /api/help/report` | Public label mapped to a queue reason, the story in `details`, `evidence.source = public_form` plus link, contact email, and `urgent`, `reporter_ip`, `target_id` null until a person identifies the member |

In-app reasons (`app/api/safety/report/route.ts`): `harassment`, `spam`, `underage`, `impersonation`, `hate`, `unsafe`, `other`. A member cannot report their own id. More than 10 reports from the same account in an hour returns 429. The route writes `audit_log` action `report.filed` and calls `opsAlert`.

Public labels (`app/api/help/report/route.ts`): "Someone under 18", "Shared without consent", "Impersonation", "Harassment or threats", "Hate or discrimination", "Scam or spam", "Illegal content", "Other". Five reports per IP per hour. `urgent` is set only for under-18 and non-consensual sharing. If the database is missing or the insert fails, the route returns 503 and does not claim the report was received. The id in a successful response is the row id.

The chat safety menu (`components/chat/safety-menu.tsx`) calls the in-app route. It tells the member that messages stay encrypted and that only the text they type is shared. Sending a report does not block. Blocking is a separate button.

Alerts (`lib/alerts/server.ts`, merged PR #50) go to `OPS_ALERT_EMAIL` through Resend, to `OPS_WEBHOOK_URL`, or to both. The body is a pointer: type, id, and an admin link. Coordinates, chat, document numbers, and the report story are redacted. The same alert is not sent again for five minutes on that server instance. If neither channel is set, the alert is a server log line. As of 2026-10-23 18:40 UTC the alerts code was deployed and `OPS_ALERT_EMAIL` was not visible in production, so do not assume an inbox is receiving these.

## 2. Severity chips and the SLA the console shows

`/admin/reports` header: "Highest severity first · SLA: safety 4h, other 24h". The home queue uses the same split (`app/admin/page.tsx`).

The chip comes from `SEV` in `lib/admin/ts-seed.ts`, keyed by the **stored reason string**. In-app reasons are lowercase and are not keys in `SEV`, so they all fall through to Low (`SEV[reason] ?? 1`). A human must read the reason text. The chip is wrong for every in-app report until that map is fixed.

| Stored reason | Where it is written | Chip today | How to triage |
|---|---|---|---|
| `underage` | In-app | Low | Safety. Immediate. Section 6. |
| `Underage` | Public form | Safety (3) | Safety. Immediate. Section 6. |
| `unsafe` | In-app | Low | Safety if the text is a threat, stalking, or coercion. Otherwise read it. |
| `harassment` | In-app | Low | Upgrade to the 4h clock when the text is a threat, stalking, or coercion. |
| `Harassment` | Public form | Medium (2) | Same upgrade rule. The chip alone is a 24h item. |
| `hate` | In-app | Low | Treat as the public "Hate or discrimination" case (Medium). |
| `Hate or discrimination` | Public form | Medium (2) | 24h clock. |
| `Illegal content` | Public form | Safety (3) | 4h. If it describes sexual material of a minor, stop and use section 7. |
| `Shared my photos` | Public form | Safety (3) | 4h. Non-consensual imagery. Do not re-host the image. |
| `spam`, `Scam or spam` | In-app / public | Low | 24h, unless money has already moved. Section 9. |
| `impersonation`, `Fake or impersonation` | In-app / public | Low | 24h. Section 9 if they are pretending to be the company. |
| `other`, `Other` | Either | Low | Read the text before assigning a clock. |

Sort in the console is severity descending, then **newest** first (`ageMin` ascending). An older Safety report can sit under a newer one with the same chip. Scan the whole open Safety band, not only the top row.

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

**Do this immediately, then a second person reviews. The insert does not suspend anyone.**

1. Identify the account. In-app reports have `target_id`. Public reports do not, until you match a profile from the link or the story. Do not suspend a guess.
2. On that user, do **both**:
   - Suspend (`POST /api/admin/mod-action`, step `suspend`), with the report id attached.
   - Require an ID check (`POST /api/admin/users/{id}/age-recheck`, or Admin → Users → **Require ID**). That route sets auth `app_metadata.age_verified` false and `age_recheck` true. Middleware then answers 403 on gated APIs until a verification provider approves them again. It does not set `mod_step` and it does not ban the auth user. Suspend and Require ID are not substitutes.
3. Leave the report open until the second reviewer has looked, if you had to act from the user page without the report id. If you used mod-action with the report id, the report is already marked resolved; the second reviewer uses `audit_log` and the user row.
4. Do not ask the reporter or the member to email a photograph of an identity document or of a minor.

`/api/admin/users/{id}/age-recheck` refuses to target the caller.

## 7. Sexual material involving a minor

> **Counsel review required.** This is a preservation and escalation note for staff. It is not legal advice, not a determination that a report is CSAM, and not the company's CyberTipline procedure. Counsel has to approve who files, what may be included, and how long objects are kept before this section is used as policy.

When a report may involve child sexual abuse material:

- Do not download, open, screenshot, forward, or copy the material. Do not ask the reporter to send a copy to email, Slack, or a phone.
- Do not put the story into a new message. The public-form alert is a pointer (id and admin link). The story stays on the report row. Do not forward even the pointer into a personal channel.
- Leave the `reports` row, its `evidence`, and any objects already in storage in place. Do not delete the account or the objects until counsel says preservation is satisfied. Section 6's suspension still applies to the account so it cannot keep using the product; suspension hides and bans, it does not delete stored objects (`Remove` does set `deleted_at` — do not Remove until counsel has said so).
- Counsel directs the report to the National Center for Missing & Exploited Children (NCMEC) CyberTipline. 18 U.S.C. § 2258A is the statute counsel will read. Staff do not freelance a filing from this runbook.
- Tell counsel the same day the report is seen.

## 8. Stalking, coercion, threats

Treat the text as Safety (4 hour clock) when it describes a threat, someone being followed, or pressure to meet or to send images. The in-app reason will often be `harassment` or `unsafe`, which the chip marks Low.

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

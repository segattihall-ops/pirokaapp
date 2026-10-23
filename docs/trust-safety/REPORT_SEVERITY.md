# Report severity and the underage protective hold

Operational note for the queue and the in-app report path. Not legal advice. `docs/trust-safety/RUNBOOK.md` is the staff procedure. This file is the map the code uses.

The admin header stays “Highest severity first · SLA: safety 4h, other 24h”. **Critical** is that 4-hour clock. Medium and low share the 24-hour clock. A person still decides every action except the underage hold below.

## In-app slugs

`components/chat/safety-menu.tsx` and `POST /api/safety/report` both use `IN_APP_REASONS` in `lib/safety/reasons.ts`. A slug that is not in `REASON_SEVERITY` cannot be added to that list without failing `lib/safety/report-safety.test.ts`.

| Slug            | Label in the menu                         | Rank     | Clock | Automatic action                                                                                          |
| --------------- | ----------------------------------------- | -------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `underage`      | Looks under 18                            | Critical | 4h    | Protective hold + Require ID (below)                                                                      |
| `csam`          | Sexual content involving a minor          | Critical | 4h    | Alert only. Do not download, copy, or delete.                                                             |
| `threats`       | Threat of violence                        | Critical | 4h    | Alert only                                                                                                |
| `stalking`      | Stalking, doxxing, or sharing my location | Critical | 4h    | Alert only                                                                                                |
| `sextortion`    | Coercion or sextortion                    | Critical | 4h    | Alert only                                                                                                |
| `ncii`          | Intimate images shared without consent    | Critical | 4h    | Alert only                                                                                                |
| `harassment`    | Harassment                                | Medium   | 24h   | None                                                                                                      |
| `hate`          | Hate or discrimination                    | Medium   | 24h   | None                                                                                                      |
| `unsafe`        | Unsafe meet-up behaviour                  | Medium   | 24h   | None. Upgrade when the text is a threat, stalking, or coercion — those now have their own critical slugs. |
| `spam`          | Spam or scam                              | Low      | 24h   | None                                                                                                      |
| `impersonation` | Impersonation                             | Low      | 24h   | None                                                                                                      |
| `other`         | Something else                            | Low      | 24h   | None. Read the text before assigning a clock.                                                             |

`csam` is the child-sexual-abuse / child-sexual-exploitation reason. It is critical so it sorts first and alerts. It does **not** auto-hold: preserving evidence and any CyberTipline step are a person’s job, with counsel. Do not delete the account from this report.

## Public form labels

Stored on `reports.reason` by `POST /api/help/report`. There is often no `target_id`, so nothing is auto-held.

| Public label           | Stored reason          | Rank     |
| ---------------------- | ---------------------- | -------- |
| Someone under 18       | Underage               | Critical |
| Shared without consent | Shared my photos       | Critical |
| Illegal content        | Illegal content        | Critical |
| Harassment or threats  | Harassment             | Medium   |
| Hate or discrimination | Hate or discrimination | Medium   |
| Scam or spam           | Scam or spam           | Low      |
| Impersonation          | Fake or impersonation  | Low      |
| Other                  | Other                  | Low      |

The public “Harassment or threats” label is still one button, stored as medium. In-app threats are the separate critical slug `threats`. Read a public harassment report before leaving it on the 24-hour clock.

Older demo-queue strings (`Threats or violence`) stay critical so seeded rows and any already stored copies sort correctly.

Unknown strings sort as low. That is intentional: a new slug must be added to the map, and the test fails until it is.

## Queue order and alerts

Open reports sort by rank (critical, then medium, then low). Inside one rank, newer reports come first — same order the console already used.

Every filed report calls `opsAlert` (`lib/alerts/server.ts`). When `OPS_ALERT_EMAIL` is set, that helper emails the inbox; `OPS_WEBHOOK_URL` still works. The body is only:

`type=<reason> severity=<critical|medium|low> id=<report id> <origin>/admin/reports`

The reason is the stored token, not the member’s text. The alert builder does not take the narrative, a coordinate, a handle, a contact address, or a conversation id. Those stay on the report row.

## Underage protective hold

An in-app report with reason `underage` and an age-verified reporter:

1. Inserts the report (this always happens, including when the hold is skipped).
2. Sets `users.visibility` to `hidden` and `users.safety_hold_at`. Map, nearby, and hotspot queries already skip hidden members. Search drops rows with `safety_hold_at` (a member who simply chose hidden is not treated as held). Profile reads by other members return 404.
3. Blocks new DMs, new interests (matches), meet proposals, and new group, area, and place messages while the hold is on. Existing rows are not deleted.
4. Flags Require ID: auth `app_metadata.age_verified = false`, `age_recheck = true`, `age_method = null`. Same flag as Admin → Users → Require ID. It is not an auth ban.
5. Writes `audit_log` `safety.hold_applied` with the report id and the previous visibility / 18+ flags. No narrative and no coordinates.

It does not set `mod_step`, `deleted_at`, or `ban_duration`.

Public-form “Underage” does not hold anyone. There is no account id until a person matches the report.

### Who can trigger it, and the abuse trade-off

The hold runs only when `session.ageVerified` is true. Middleware already answers 403 on `/api/safety/report` until the 18+ gate passes; the check is there so a bypassed gate or a demo session cannot freeze members. An unverified reporter still files a critical report and the ops alert fires. A person applies the hold.

Cap: **2 holds per reporter per 24 hours**, counted from `safety.hold_applied` audit rows. Further underage reports from that account still file and still alert. A target already on hold is not written again, so the saved “previous visibility” is not overwritten.

Requiring photo verification or a minimum account age would stop some weaponised reports and would also leave a reported minor on the map when the only witness is new. This build does not add that delay. The cap and the age gate are the brakes. A false hold is undone from Admin → Users → **Release hold**, which restores the saved visibility and, if this hold wrote Require ID, puts the 18+ flag back. Release does not delete anything.

If the previous 18+ flag cannot be read, the account is still hidden and Require ID is left for a person (the audit action is `safety.hold_require_id_failed`). Release will not guess that the account was verified.

### Database

`supabase/migrations/20261023190000_051_underage_protective_hold.sql` adds the columns and a check that a held row stays `visibility = hidden`. **It is not applied by this change.** The owner runs it in Supabase before relying on the hold. Until then, a missing column is audited as `safety.hold_schema_pending`, the report is still stored, and the critical alert still fires.

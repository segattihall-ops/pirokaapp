# Age verification test plan (Persona sandbox)

Manual test script for the 18+ gate. Run it on a **non-production** host (the Vercel preview for the PR branch). Do not run it against the live domain.

## Before you start

Set these in the preview environment (Vercel → Preview), then redeploy:

| Variable | Value |
|---|---|
| `AGE_PROVIDER` | `persona` |
| `PERSONA_API_KEY` | the **sandbox** key (`persona_sandbox_...`) |
| `PERSONA_TEMPLATE_ID` | the age template ID (`itmpl_...`) |
| `NEXT_PUBLIC_PERSONA_ENVIRONMENT_ID` | the sandbox environment ID (`env_...`) |

If the page shows a Cloudflare Turnstile ("Confirm you are human"), stop. Do not solve it. Use a host without the challenge, or ask the owner to set the Turnstile test key for the preview only.

## Steps

1. Open the preview and sign in (demo or anonymous, as available).
2. Accept the 18+ and terms checkboxes. This calls `POST /api/consent`.
3. At the age step, click **Start age check**.
   - Expected: `POST /api/age/start` returns `200` with an `inquiryId` starting with `inq_`.
   - Expected: the Persona modal opens.
4. Complete the Persona flow using the sandbox test options. Use only test data, never a real document or face.
5. Expected: the modal closes, `POST /api/age/verify` returns `200`, and the chat shows "verified 18+". The enter button appears.

## Negative checks

| Check | How | Expected |
|---|---|---|
| No consent | Call `POST /api/age/start` before consent | `409` |
| Not signed in | Call `POST /api/age/start` with no session | `401` |
| Provider off | Set `AGE_PROVIDER=local` on the preview | `local` is refused (`No age-verification provider configured`) |
| Fake token | Call `POST /api/age/verify` with `{"method":"id","token":"local:id:1"}` | `422`, not verified |
| Inquiry from another user | Use an approved inquiry from a different account | `422`, "belongs to another account" |
| Not approved | Stop the Persona flow before it finishes | `422`, "not approved" |

## What must be stored

After a pass, check the user row (Supabase `app_metadata` or the demo cookie):

- `age_verified` is `true`.
- `age_method` is `id`.
- No birthdate, age number, image or document is stored in our database.

## Known gaps to verify on first run

- The binding check reads `attributes.reference_id` from the Persona response. If every real pass returns "belongs to another account", check the field name in one approved sandbox inquiry, then fix `lib/age/index.ts`.
- The Persona flow starts a new inquiry each time the button is clicked. Resuming an unfinished inquiry is not implemented yet.

## Record the result

Note the date, the preview URL, the Persona sandbox inquiry ID (`inq_...`, not personal data) and which checks passed or failed.

# PIROKA Legal Readiness — October 24, 2026

## Purpose

This file is the internal implementation/readiness record for the PIROKA Legal Center. It separates:

- code/policy work that can be reviewed and merged;
- operational controls that must be tested before public launch; and
- external legal/business actions that cannot be completed by repository code.

PIROKA uses Sniffies only as a structural competitor benchmark. PIROKA policy text is independently written for X RankFlow Media Group LLC, PIROKA's product behavior, vendors, and current law.

## Confirmed operator facts

- Operator / contracting party: **X RankFlow Media Group LLC**
- Formal notice address: **8 The Green, Dover, DE 19904, United States**
- Intended initial public territory: **United States nationwide**
- PIROKA brand/domain/source-code chain of title: **not yet fully evidenced**

## Legal Center implemented in this branch

Public index: `/legal`

### Legal
- Terms of Service
- Subscription & Billing Terms
- Copyright / DMCA Policy
- Legal & Law-Enforcement Requests
- 18 U.S.C. §§ 2257 / 2257A Notice

### Privacy & Data
- Privacy Policy
- California Privacy Notice
- Location Privacy & Safety
- Account Deletion & Data Rights
- Cookie & Tracking Notice
- Data Retention Policy
- Automated Moderation Disclosure

### Safety & Content
- Community Guidelines
- Acceptable Use Policy
- Content Policy
- Safety Center
- Content Removal Policy
- Appeals Policy
- NCII / Intimate Image Removal
- Minor & CSAM Safety Policy
- Exploitation & Commercial Sex Policy

### Operational legal UX
- public report/removal intake without account;
- TAKE IT DOWN / NCII request fields and structured 48-hour deadline;
- moderation appeal intake;
- appeal recovery for suspended/removed accounts using action ID + account email;
- admin visibility of NCII deadline and critical CSAM/trafficking escalations;
- account deletion and data export links remain backed by existing APIs;
- billing language is conditional on the existing billing kill switch.

## Current primary-law basis

### TAKE IT DOWN Act / NCII

47 U.S.C. § 223a requires a covered platform's notice-and-removal process to accept a written request containing an electronic/physical signature, identification and information sufficient to locate the depiction, a good-faith non-consent statement, and contact information. A valid covered request must be acted on as soon as possible and no later than 48 hours, including reasonable efforts to identify and remove known identical copies.

Primary source:
https://uscode.house.gov/us/usc/119-120/t47/s223a/

Implementation:
- `components/help/report-form.tsx`
- `app/api/help/report/route.ts`
- `lib/legal/tida.ts`
- `app/api/admin/reports/route.ts`
- `app/admin/reports/page.tsx`

### Child exploitation provider reporting

18 U.S.C. § 2258A imposes provider reporting duties to NCMEC when qualifying actual-knowledge facts/circumstances are obtained. The statute does not create a general duty to affirmatively monitor all users or communications merely because the reporting obligation exists.

Primary source:
https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section2258A

Repository policy:
- `/help/minors`

Operational launch requirement:
- trained escalation procedure;
- NCMEC CyberTipline credentials/process;
- evidence-handling protocol that avoids unnecessary copying of suspected CSAM.

### Recurring billing

15 U.S.C. § 8403 (ROSCA) requires clear material terms before billing information, express informed consent, and a simple mechanism to stop recurring charges.

Primary source:
https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section8403

Repository:
- `/help/billing`
- existing `app/api/billing/cancel/route.ts`
- existing `lib/billing/enabled.ts` kill switch

### DMCA

17 U.S.C. § 512 safe-harbor procedures depend in part on maintaining a designated agent and notice/counter-notice procedures. The public policy is implemented in code, but the U.S. Copyright Office designated-agent registration is an external operational action.

Copyright Office:
https://www.copyright.gov/dmca-directory/

Repository:
- `/help/dmca`

### Age assurance / adult content

PIROKA is 18+ and currently implements a production age-check gate with provider-dependent age assurance. Nationwide launch must still account for state-specific adult-content/age-verification laws based on the actual content made available in each jurisdiction.

Relevant Supreme Court authority:
Free Speech Coalition, Inc. v. Paxton, 606 U.S. ___ (2025)
https://www.supremecourt.gov/opinions/24pdf/23-1122_3e04.pdf

Repository:
- `components/age/age-check.tsx`
- `components/home/signup-chat.tsx`
- `/help/terms`
- `/help/privacy`
- `/help/content`
- `/help/minors`

## Founder-approved content policy reflected in this branch

Public:
- non-explicit adult nudity may be allowed;
- visible genitals are prohibited;
- explicit sexual acts are prohibited.

Private:
- visible adult genitals may be allowed in private albums;
- lawful adult explicit media may be exchanged privately between consenting adult members.

Prohibited everywhere:
- minors / CSAM;
- grooming;
- NCII;
- sexual coercion;
- trafficking;
- prostitution/commercial sexual services;
- hidden-camera intimate material;
- sexual assault;
- unlawful exploitative content.

## Payment-provider status

PayPal is technically integrated in the repository. This does **not** establish that PayPal has commercially approved PIROKA's actual adult social-discovery/content model.

Therefore:
- new billing must remain disabled unless the active processor is authorized for the actual use case;
- the Legal Center does not promise PayPal availability;
- founder-approved intended pricing is documented, but the checkout display controls any actual transaction.

**Launch blocker, not merge blocker:** obtain authoritative processor eligibility/approval or replace the processor.

## Merge blockers vs. launch blockers

### Merge blockers for this branch
All must be green before merge:
- TypeScript/build passes;
- Legal Center routes render;
- NCII form compiles and stores structured TIDA data;
- appeal API/UI compile;
- no unresolved conflict with main;
- preview deployment is READY.

### External / operational launch blockers
These do not require holding this code branch open once code checks are green, but public launch must not treat them as complete:

1. Register and maintain XRMG's DMCA designated agent with the U.S. Copyright Office.
2. Obtain payment-processor approval for PIROKA's actual business model or replace the processor.
3. Complete a current 50-state age-assurance/adult-content applicability review for the final content configuration.
4. Have specialized U.S. counsel review:
   - §2257 / §2257A treatment for the private explicit-content model;
   - final liability/indemnity/governing-law language;
   - state dating/social-service cancellation rules where applicable;
   - state privacy/sensitive-data obligations for launch configuration.
5. Complete PIROKA name/logo/domain/source-code IP chain-of-title and trademark clearance.
6. Train and validate the NCII known-identical-copy workflow.
7. Train and validate CSAM/NCMEC escalation.
8. Validate production location obfuscation/retention and account deletion against the published policies.
9. Verify which optional vendors are actually enabled before final production Privacy Policy publication.

## Publication rule

A policy may be merged as the canonical code version without being represented internally as "attorney approved" or "launch cleared." The public launch gate must remain blocked until applicable operational/external blockers above are evidenced.

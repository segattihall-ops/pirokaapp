/**
 * Help, safety & legal copy — the exact text of design_handoff → Piroka_Help.dc.html.
 * The interactive tabs (Help center, Talk to a person, Account standing, Report content) live in
 * components/help/*; this module holds the FAQ and the five policy documents they render.
 * Contact addresses come from lib/contact.ts.
 */

import { CONTACT_EMAIL } from '@/lib/contact';

export type Section = { heading: string; body: string };
export type Content = {
  title: string;
  meta: string;
  /** Draft legal text for design review — rendered with the "have counsel review" banner. */
  draft: boolean;
  sections: Section[];
};

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Who can see my exact location?',
    a: 'No one, by default. Others see a blurred area — a neighborhood (~0.3 mi) or wider area (~1 mi) — and distances are rounded. Your precise location is shared only inside Meet Mode, only after both people agree, and it switches off when Meet Mode ends.',
  },
  {
    q: 'Why is my location blurred more in some places?',
    a: 'In countries and regions where queer people face legal or social danger, πroka widens your blur to Area, hides photos by default and warns you about fast meetups. You can lower the protection, but we don’t recommend it.',
  },
  {
    q: 'How do albums work?',
    a: 'Your album is private. Unlock it for one person inside a chat, or approve when someone asks. You can lock it again at any time. Free and Anonymous accounts hold 2 photos; Plus and Premium hold 5.',
  },
  {
    q: 'Are my messages encrypted?',
    a: 'Yes. Chats are end-to-end encrypted, so only you and the person you’re talking to can read them. If you report a chat, you choose which recent messages to attach as evidence.',
  },
  {
    q: 'I was warned or banned. What now?',
    a: 'Every action comes with the reason and the rule it relates to. Serious safety violations can lead to an immediate suspension; everything else starts with a warning. You can appeal any decision from Account standing — a different moderator reviews it.',
  },
  {
    q: 'How do I hide πroka on my phone?',
    a: 'In ME → Privacy, switch the app icon to Calculator, Weather or Notes. Quick exit (press Esc twice or tap the shield) instantly shows a decoy screen.',
  },
  {
    q: 'Is πroka free?',
    a: 'Yes. The map, chat, filters, communities and safety tools are free. Plus ($5/mo) adds advanced filters, travel and 5 album photos. Premium ($10/mo) adds priority support. There are no ads on any plan.',
  },
  {
    q: 'How do I download or delete my data?',
    a: 'ME → Privacy → Download my data gives you a file with everything we hold. Delete account removes your profile immediately and your data within 30 days, except what the law requires us to keep.',
  },
];

export const HELP_CONTENT: Record<string, Content> = {
  guidelines: {
    title: 'Community Guidelines',
    meta: 'Updated September 2026',
    draft: false,
    sections: [
      {
        heading: 'Consent first',
        body: 'Ask before sending explicit photos. Stop when someone says no or stops answering. Never share someone’s photos, album or location outside πroka.',
      },
      {
        heading: 'Adults only',
        body: 'Everyone on πroka is 18 or older and has passed an age check. Anything involving a minor is removed immediately and reported to the authorities.',
      },
      {
        heading: 'No hate',
        body: 'No racism, transmisogyny, fatphobia, femmephobia or ableism — including “no fats, no femmes” style filters in your bio. Preferences are fine; putting people down is not.',
      },
      {
        heading: 'Be real',
        body: 'One person, one account. No impersonation, scams, catfishing, selling or spam. Discreet is welcome; fake is not.',
      },
      {
        heading: 'No drugs for sale or arrangement',
        body: 'Don’t buy, sell, offer or arrange drugs on πroka — including coded words, emojis or “party” requests. Profiles and messages that do are removed. Harm-reduction questions are always welcome: see Safety Center → Chemsex & party safety.',
      },
      {
        heading: 'Meet safely',
        body: 'Meet in public first if you’re unsure, use SafeMeet and tell a friend. Pressuring someone to meet, or to share their location, is harassment.',
      },
      {
        heading: 'What happens if you break these rules',
        body: 'First a warning with the reason. Repeated or serious violations lead to temporary or permanent suspension. You can appeal every decision.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Eligibility',
        body: 'πroka is an adults-only service. You must be at least 18 years old and legally able to agree to these terms where you live. Minors are prohibited. Do not create an account, use the map, post, or message if you are under 18, and do not post or request anyone under 18. You must pass our age check before using πroka. If we believe an account belongs to a minor, or that content involves a minor, we remove it, close the account, and report child sexual abuse material to the authorities as the law requires. The Community Guidelines, the Privacy Policy, and the Safety Center are part of these terms.',
      },
      {
        heading: 'Your account',
        body: 'You are responsible for your account and for what you post. Keep your login private. You can delete your account at any time from ME → Privacy. One person, one account. Do not share your account or let someone else use it.',
      },
      {
        heading: 'Your content',
        body: 'You keep ownership of the photos, text, and other content you submit. You give πroka a limited, non-exclusive license to host, store, transmit, and display that content only as needed to run the service, and only to the people you choose to show it to. The license ends when you delete the content or your account, except for copies we must keep for a limited time for safety, legal process, or backups. You promise that you have the rights to what you post, that you are the person shown or have consent from everyone shown, and that every person in a sexual image was 18 or older when it was made.',
      },
      {
        heading: 'Prohibited conduct',
        body: 'Do not use πroka to harass, stalk, threaten, or coerce anyone. Do not extort sexual images, money, or anything else (sextortion). Do not share or threaten to share intimate images of someone without their consent (non-consensual intimate imagery, NCII). Do not post, request, or trade child sexual abuse material (CSAM). Do not commit fraud, run a scam, or impersonate someone. Do not use πroka for commercial solicitation or prostitution. We remove this content, close accounts, and report crimes when the law requires it. The Community Guidelines name more rules, including no drugs for sale or arrangement and no hate.',
      },
      {
        heading: 'Paid plans',
        body: 'Plus and Premium renew monthly until you cancel. You can cancel any time; the plan runs to the end of the paid period. Core features never require payment. Fees are charged by the payment provider shown at checkout, under that provider’s terms.',
      },
      {
        heading: 'Moderation',
        body: 'We may remove content or restrict accounts that break these terms, the Community Guidelines, or the law. We tell you why, and you can appeal from Account standing. A different reviewer looks at an appeal.',
      },
      {
        heading: 'Termination',
        body: 'You may stop using πroka and delete your account at any time. We may suspend or close your account, or remove content, if you break these terms or the law, or to protect someone. Where we can, we tell you the reason. After your account ends, these parts still apply: the license for copies we must keep, the rules on prohibited conduct for what already happened, the disclaimers, the limit on liability, indemnification, and the dispute terms.',
      },
      {
        heading: 'Disclaimer of warranties',
        body: 'πroka is provided as is and as available. To the extent the law allows, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee that you will meet anyone, that another person is who they say they are, or that the service will be uninterrupted, secure, or error-free. Some places do not allow these disclaimers. There, they apply only as far as the law allows.',
      },
      {
        heading: 'Limitation of liability',
        body: 'πroka connects adults. To the extent the law allows, πroka and its operators are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, including for what happens when you meet someone. Our total liability for a claim about the service is limited to the amount you paid us for πroka in the three months before the claim. If you paid nothing, our total liability is limited to the smallest amount the law allows us to set. Some places do not allow these limits. There, they apply only as far as the law allows. We give you tools to block, report, and get help, and we act on reports.',
      },
      {
        heading: 'Indemnification',
        body: 'To the extent the law allows, you will defend and indemnify the operator of πroka, [COMPANY LEGAL NAME AND ADDRESS - COUNSEL TO CONFIRM], and the people who work on the service, against claims by someone else that arise from your content, your use of πroka, or your breaking these terms or the law. You will cooperate with that defense. This does not require you to pay for a claim that exists only because we broke the law.',
      },
      {
        heading: 'Copyright and DMCA',
        body: `We respect copyright. The designated agent for notices is ${CONTACT_EMAIL.dmca}. The agent’s postal address is [COMPANY LEGAL NAME AND ADDRESS - COUNSEL TO CONFIRM]. To ask us to take something down, email a notice that includes: your physical or electronic signature; the copyrighted work you believe was used; the πroka URL or other location of the material, enough for us to find it; your name, address, telephone number, and email; a statement that you believe in good faith that the use is not authorized; and a statement, under penalty of perjury, that the notice is accurate and that you are the owner or are authorized to act for the owner. If the notice is complete enough, we remove or disable access to the material. If we remove your content, we may tell you and you may send a counter-notice to the same address. A counter-notice must include your signature, identification of what was removed and where it appeared, a statement under penalty of perjury that you believe the removal was a mistake or misidentification, your name and contact information, and a statement that you consent to the jurisdiction of the federal court for the judicial district where you live (or, if you live outside the United States, for any judicial district where the operator may be found) and that you will accept service of process from the person who sent the notice. We may restore the material after the time the law allows, unless the person who sent the notice tells us they have filed a court action. We close accounts of repeat infringers in appropriate circumstances.`,
      },
      {
        heading: 'Disputes',
        body: `Try informal resolution first. Email ${CONTACT_EMAIL.legal} with a short description of the dispute and your account email, and give us 30 days after we receive it before you start a formal claim. If we do not resolve it in that time, you and πroka agree to individual arbitration before a neutral arbitrator, except for the small-claims carve-out in this section. The class-action waiver means there is no class action, class arbitration, or other representative action. Either of us may still bring an individual claim in small-claims court instead of arbitration, if the claim qualifies. You may opt out of arbitration during a 30-day opt-out window after you first accept these terms, by emailing ${CONTACT_EMAIL.legal} with the subject “Arbitration opt-out”, your name, and the email on your account. Opting out does not change any other part of these terms. Nothing here takes away a right the law does not let you waive. This dispute section is draft text pending counsel review. Counsel must confirm the arbitration administrator, the rules, and the opt-out window before it is treated as final.`,
      },
      {
        heading: 'Governing law',
        body: 'These terms are governed by the laws of [GOVERNING STATE - COUNSEL TO CONFIRM], without regard to conflict-of-law rules, except where the law where you live does not allow that choice. Venue for a dispute that is not in arbitration and is not in small-claims court is the state or federal courts located in [GOVERNING STATE - COUNSEL TO CONFIRM], except where the law gives you the right to sue somewhere else. The placeholder is not a chosen state. Counsel must confirm the governing state and the venue before this section is treated as final.',
      },
      {
        heading: 'Changes to these terms',
        body: 'We may change these terms. The date under the title is the Last updated date. When we make a material change, we update that date and, when the law or the change requires it, we ask you to accept the new terms before you continue. If you keep using πroka after the new terms apply, you accept them. If you do not agree, stop using πroka and delete your account. A change to the dispute section applies only as the law allows, and not to a dispute we were already on notice of, except where the law says otherwise.',
      },
      {
        heading: 'Contact',
        body: `The operator of πroka is [COMPANY LEGAL NAME AND ADDRESS - COUNSEL TO CONFIRM]. That name and address are not filled in yet; counsel must confirm them. Terms questions: ${CONTACT_EMAIL.legal}. Copyright notices: ${CONTACT_EMAIL.dmca}. Safety: ${CONTACT_EMAIL.safety}. Privacy: ${CONTACT_EMAIL.privacy}. Support: ${CONTACT_EMAIL.support}.`,
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    meta: 'Effective September 2026',
    draft: false,
    sections: [
      {
        heading: 'What we collect',
        body: 'Your profile details, photos, approximate location while you use the app, messages (end-to-end encrypted — we can’t read them), and basic device and payment data.',
      },
      {
        heading: 'What we never do',
        body: 'We don’t sell your data. We don’t share your HIV status, sexuality or location with advertisers — there are no ads. We don’t share data with data brokers.',
      },
      {
        heading: 'Location',
        body: 'We store your location at reduced precision and delete location history after 24 hours. Others only see an approximate area unless you both turn on Meet Mode.',
      },
      {
        heading: 'Age verification',
        body: 'Your face check runs on your device. We keep only the result (18+ yes/no), never the image.',
      },
      {
        heading: 'Abuse reports',
        body: 'When you report someone or submit the public removal form, we store what you send us together with the IP address the report came from. We use it only to keep people safe — to spot repeat or abusive reports — it is visible only to our moderators, and it is deleted when the report is closed.',
      },
      {
        heading: 'Your rights',
        body: 'Download everything we hold, correct it, or delete it from ME → Privacy. We follow GDPR, LGPD and US state privacy laws.',
      },
      { heading: 'Contact', body: CONTACT_EMAIL.privacy },
    ],
  },
  safety: {
    title: 'Safety Center',
    meta: 'Tools and advice',
    draft: false,
    sections: [
      {
        heading: 'Before you meet',
        body: 'Check trust signals — human, photo and phone verification. Video chat first if you’re unsure. Meet somewhere public the first time.',
      },
      {
        heading: 'SafeMeet',
        body: 'Meet Mode starts a check-in timer and can share your plan and live location with a trusted contact for a set time. If you don’t check in, we remind you, then alert your contact.',
      },
      {
        heading: 'If something goes wrong',
        body: 'Block and report in one tap from the chat or profile. Evidence is kept for moderators. For emergencies, call local emergency services first.',
      },
      {
        heading: 'Chemsex & party safety',
        body: 'Never use alone: set a SafeMeet check-in or call the Never Use Alone hotline (1-800-484-3731). Don’t mix GHB/GBL with alcohol, space doses with a timer, and test for fentanyl. In an overdose call 911, use the recovery position and give naloxone if opioids could be involved. Someone who can’t say no can’t consent. PEP works best within 72 hours. Free, confidential help: SAMHSA 1-800-662-4357 or 988.',
      },
      {
        heading: 'In higher-risk regions',
        body: 'Location widens automatically, photos are hidden by default and meetups arranged very quickly are flagged. Be wary of people who push to meet within minutes.',
      },
    ],
  },
  '2257': {
    title: '18 U.S.C. § 2257 Statement',
    meta: 'Record-keeping compliance',
    draft: false,
    sections: [
      {
        heading: 'Exemption',
        body: 'πroka does not produce sexually explicit content. All content is created by users, who are verified as 18 or older before they can post.',
      },
      {
        heading: 'User-generated content',
        body: 'Users confirm they are the person shown, or have consent from everyone shown and that everyone shown was 18 or older at the time the image was created.',
      },
      {
        heading: 'Custodian of records',
        body: `πroka, Inc. · Compliance Officer · [COMPANY LEGAL NAME AND ADDRESS - COUNSEL TO CONFIRM] · ${CONTACT_EMAIL.compliance}`,
      },
    ],
  },
};

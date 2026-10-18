/**
 * Help, safety & legal copy — the exact text of design_handoff → Piroka_Help.dc.html.
 * The interactive tabs (Help center, Talk to a person, Account standing, Report content) live in
 * components/help/*; this module holds the FAQ and the five policy documents they render.
 */

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
    meta: 'Effective September 2026',
    draft: false,
    sections: [
      {
        heading: 'Eligibility',
        body: 'You must be at least 18 and legally able to agree to these terms where you live. You must pass our age check before using πroka.',
      },
      {
        heading: 'Your account',
        body: 'You’re responsible for your account and what you post. Keep your login and PIN private. You can delete your account at any time.',
      },
      {
        heading: 'Content',
        body: 'You keep ownership of your photos and messages. You give πroka a limited license to host and show them to the people you choose, only to run the service.',
      },
      {
        heading: 'Paid plans',
        body: 'Plus and Premium renew monthly until you cancel. You can cancel any time; the plan runs to the end of the paid period. Core features never require payment.',
      },
      {
        heading: 'Moderation',
        body: 'We may remove content or restrict accounts that break the Community Guidelines. We tell you why, and you can appeal.',
      },
      {
        heading: 'Liability',
        body: 'πroka connects adults. We are not responsible for what happens when you meet someone, but we give you tools to stay safe and act quickly on reports.',
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
        heading: 'Your rights',
        body: 'Download everything we hold, correct it, or delete it from ME → Privacy. We follow GDPR, LGPD and US state privacy laws.',
      },
      { heading: 'Contact', body: 'privacy@piroka.app' },
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
      { heading: 'Custodian of records', body: 'πroka, Inc. · Compliance Officer · compliance@piroka.app' },
    ],
  },
};

import { LEGAL_CONTENT } from '@/lib/legal-content';

export type Section = { heading: string; body: string };
export type Content = {
  title: string;
  meta: string;
  draft: boolean;
  sections: Section[];
};

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Who can see my exact location?',
    a: 'PIROKA is designed so other users receive an approximate or privacy-adjusted location rather than your raw device coordinates. Approximation reduces risk but does not guarantee anonymity because people may infer location from repeated observations, landmarks, profile details, photos, or chat.',
  },
  {
    q: 'Are my messages encrypted?',
    a: 'One-to-one chat is designed to use end-to-end encryption, so the server stores ciphertext rather than readable message text. Metadata such as participants and timestamps may still exist, and messages you intentionally attach to a safety report can be reviewed as evidence.',
  },
  {
    q: 'What is allowed in public photos?',
    a: 'Non-explicit adult nudity may be allowed, but visible genitals and explicit sexual acts are not allowed on public-facing profiles or surfaces. Private albums and private member-to-member media may allow lawful adult explicit content subject to consent, age, and safety rules.',
  },
  {
    q: 'I was warned, limited, suspended, or removed. Can I appeal?',
    a: 'Yes, when the action is eligible. Use Account standing & appeals while signed in and submit the moderation action ID with your explanation. PIROKA reviews the action, rule, available evidence, and your appeal.',
  },
  {
    q: 'How do I report intimate images shared without consent?',
    a: 'Use Report or request removal and choose “Shared without consent.” For a valid request covered by the federal TAKE IT DOWN Act, PIROKA must remove or disable access to the reported intimate image and known identical copies within 48 hours.',
  },
  {
    q: 'How do I download or delete my data?',
    a: 'Use the privacy controls in your account to export available account-linked information or delete your account. Some safety, fraud, accounting, legal-hold, or other records may be retained when law permits or requires it.',
  },
  {
    q: 'Is paid billing active?',
    a: 'Paid checkout is available only when PIROKA billing is enabled and the active payment provider is configured and commercially permitted for the PIROKA use case. The exact price and renewal interval shown at checkout control the transaction.',
  },
  {
    q: 'Who operates PIROKA?',
    a: 'PIROKA is operated by X RankFlow Media Group LLC. Formal notices may be sent to 8 The Green, Dover, DE 19904, United States.',
  },
];

export const HELP_CONTENT: Record<string, Content> = {
  ...LEGAL_CONTENT,
};

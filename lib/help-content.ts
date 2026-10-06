type Section = { heading: string; body: string };
type Content = { title: string; sections: Section[] };

export const HELP_CONTENT: Record<string, Content> = {
  help: {
    title: 'Help Center',
    sections: [
      { heading: 'Getting Started', body: 'Create an account, verify you are 18+, and set up your profile. Your main photo stays blurred until both of you message - then you see each other clearly.' },
      { heading: 'Finding People', body: 'The live map shows whos nearby by intent (hosting, visiting, looking now). Tap any marker to preview their profile. Add to favorites to follow activity.' },
      { heading: 'Chatting Safely', body: 'All messages are end-to-end encrypted on your device. No servers see plaintext. Sign out clears your encryption keys.' },
      { heading: 'Check-ins and Status', body: 'Set your status (hosting, visiting, looking now) on the map. Check in to places, events, and testing sites. Others see this info within 5km.' },
      { heading: 'Blocking and Reporting', body: 'Block anyone from the chat or profile. Blocking is silent - they dont know. Report content/users anytime; reviewers act within 24h.' },
      { heading: 'Photos and Privacy', body: 'Your main photo blurs until mutual conversation. Your album stays private. Blurred photos let people judge character before face.' },
      { heading: 'Travel Mode', body: 'Browse other cities without showing your location. Your pin stays home. Great for planning trips or researching new areas.' },
      { heading: 'Area Board', body: 'Post public messages in your area (5km radius). Messages are unencrypted and visible to everyone nearby. Great for local announcements.' },
    ],
  },
  support: {
    title: 'Talk to a Person',
    sections: [
      { heading: 'Contact Support', body: 'Email support@piroka.app with details of your issue. Human support team responds within 24h (Standard) or 4h (Premium).' },
      { heading: 'Account Issues', body: 'Locked out? Forgot password? Email with your account email. Well verify and send recovery instructions.' },
      { heading: 'Report a Bug', body: 'Found something broken? Include what you were doing, what happened, and screenshots if helpful.' },
      { heading: 'Feature Requests', body: 'Have an idea? We read all feedback. Email support or use the feedback button in ME > Settings.' },
    ],
  },
  appeals: {
    title: 'Account Standing',
    sections: [
      { heading: 'Moderation Ladder', body: '1) Warning - activity flagged, account stays active. 2) Pause - 24h timeout. 3) Suspension - 30 days offline. 4) Ban - permanent.' },
      { heading: 'Check Your Status', body: 'Go to ME > Account Standing. Youll see any active actions, the reason, and when it expires.' },
      { heading: 'Appeal a Decision', body: 'Disagree with a moderation action? File an appeal from Account Standing. A different reviewer reads it within 48h.' },
      { heading: 'What Gets Flagged', body: 'Harassment, threats, non-consensual content, spam, ban evasion, underage activity.' },
    ],
  },
  report: {
    title: 'Report Content',
    sections: [
      { heading: 'How to Report', body: 'Tap ... on any profile, photo, or message. Select a reason (harassment, spam, unsafe, other) and submit. No account required.' },
      { heading: 'What Happens', body: 'Reports are reviewed by moderation within 24h. If content breaks rules, the post is removed and the account may get a warning.' },
      { heading: 'Staying Anonymous', body: 'Your report is confidential. The reported user wont know who reported them.' },
      { heading: 'Privacy Reports', body: 'If someone ignored your block or shared private info, select "Harassment" and explain in the details field.' },
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    sections: [
      { heading: 'Be Respectful', body: 'Treat others how you want to be treated. Dont harass, threaten, or demean. Disagreement is fine; meanness isnt.' },
      { heading: 'Consent First', body: 'Get clear consent before sharing explicit photos or arranging meetups. Dont pressure, ghost, or bait.' },
      { heading: 'No Fake Profiles', body: 'Use your real identity or a consistent alias. Dont impersonate others or use stolen photos.' },
      { heading: 'Keep It Legal', body: 'No selling services, spam links, or illegal goods. No underage users or content.' },
      { heading: 'Respect Privacy', body: 'Dont share others photos, names, or location without consent. This is a private app for discovery, not a billboard.' },
      { heading: 'No Violence', body: 'Threats, violence, or hate speech toward individuals or groups is instant ban.' },
    ],
  },
  safety: {
    title: 'Safety Center',
    sections: [
      { heading: 'Meeting Safely', body: 'Meet in public first. Tell a friend where youre going. Trust your gut - if something feels off, it probably is. You can always block and leave.' },
      { heading: 'SafeMeet Feature', body: 'Share your location with a trusted friend during meetups. They see where you are and can reach you. Tap to enable in ME > SafeMeet.' },
      { heading: 'Checking Photos', body: 'Use reverse image search. Ask for video verification. Video calls before meeting help confirm someone is real.' },
      { heading: 'Testing and Health', body: 'Piroka partners with health providers for discreet testing. Visit the apps testing directory to find nearby clinics.' },
      { heading: 'What to Avoid', body: 'Never give money upfront. Never share banking details. Never meet someone who insists on a secluded spot. Never share your home address early.' },
      { heading: 'If Something Happens', body: 'Report immediately. Contact local authorities if needed. Piroka support is available 24/7 to help.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      { heading: 'Draft Notice', body: 'These terms are a draft pending legal counsel review. The final version will be published before launch.' },
      { heading: 'Basic Rules', body: 'You must be 18+. You own your content. You agree not to spam, threaten, or harass.' },
      { heading: 'Liability', body: 'Piroka is provided as-is. Were not liable for meetup outcomes, user behavior, or data loss.' },
      { heading: 'Data and Privacy', body: 'We store minimal data. Encrypted messages live on your device. See Privacy Policy for details.' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { heading: 'Draft Notice', body: 'This policy is a draft pending legal counsel review. The final version will be published before launch.' },
      { heading: 'What We Collect', body: 'Account info (email, age). Location (fuzzy, server-side). Photos (encrypted, optional). No browsing data, no third-party tracking.' },
      { heading: 'How We Use It', body: 'To authenticate you. To show you nearby people. To enforce safety rules. To improve the app. Never sold to third parties.' },
      { heading: 'Encryption', body: 'Messages are end-to-end encrypted. Even we cant read them. Photos in your album stay private.' },
      { heading: 'Deletions', body: 'Delete your account anytime from ME > Settings. All data is purged within 30 days.' },
    ],
  },
  '2257': {
    title: '18 U.S.C. 2257',
    sections: [
      { heading: 'Draft Notice', body: 'This section is a draft. Custodian of records details pending legal finalization.' },
      { heading: 'Compliance', body: 'Piroka complies with federal record-keeping requirements for adult-oriented content. All users must verify 18+ status.' },
    ],
  },
};

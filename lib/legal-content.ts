import { CONTACT_EMAIL, LEGAL_ENTITY_NAME, LEGAL_NOTICE_ADDRESS } from '@/lib/contact';

const operator = `${LEGAL_ENTITY_NAME}, ${LEGAL_NOTICE_ADDRESS}`;
const contacts = `Legal: ${CONTACT_EMAIL.legal} · Privacy: ${CONTACT_EMAIL.privacy} · Safety: ${CONTACT_EMAIL.safety} · Support: ${CONTACT_EMAIL.support}`;

export const LEGAL_CONTENT = {
  terms: {
    title: 'Terms of Service',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Agreement and operator',
        body: `These Terms govern your use of PIROKA, operated by ${LEGAL_ENTITY_NAME}. By accessing or using PIROKA, you agree to these Terms and the policies linked from the Legal Center. PIROKA is currently intended for users in the United States.`,
      },
      {
        heading: 'Adults only',
        body: `You must be at least 18 years old and legally able to enter into this agreement. Minors may not create or use accounts. We require an 18+ declaration and may require additional age assurance, liveness, identity, or document checks when required by law, safety risk, feature access, or suspicious activity. Refusing a required check may result in restricted access or account closure.`,
      },
      {
        heading: 'What PIROKA is',
        body: `PIROKA is an adult social-discovery and communications service. It may provide profiles, nearby and map discovery, messaging, private media, Places, travel features, status signals, safety tools, and paid features. PIROKA is not an escort agency, prostitution marketplace, emergency service, background-check service, identity guarantor, or health-care provider, and it does not arrange or supervise offline encounters.`,
      },
      {
        heading: 'Your account',
        body: `You are responsible for your account, credentials, and activity. Do not transfer, sell, share, impersonate, or create accounts to evade enforcement. Keep your information reasonably current and tell us if you believe your account has been compromised.`,
      },
      {
        heading: 'Your content and license',
        body: `You keep ownership of content you submit. You grant ${LEGAL_ENTITY_NAME} a non-exclusive, worldwide, royalty-free license to host, store, process, transmit, display, technically adapt, moderate, and use that content as reasonably necessary to operate, secure, improve, and legally administer PIROKA. This license is limited by your visibility choices and ends when the content is deleted, subject to backups, safety evidence, fraud prevention, legal holds, and other lawful retention.`,
      },
      {
        heading: 'Consent and rights in intimate content',
        body: `You may upload or send intimate content only when every depicted person was an adult when the content was created, consented to its creation, and consented to the way you are sharing it. Consent to sexual activity is not consent to recording, and consent to recording is not consent to publishing or sharing. Hidden-camera, coerced, stolen, trafficked, or non-consensual intimate content is prohibited.`,
      },
      {
        heading: 'Public and private sexual content',
        body: `Public-facing surfaces may allow non-explicit adult nudity, but visible genitals and explicit sexual acts are prohibited on public profiles and public surfaces. Private albums and private member-to-member communications may contain lawful adult nudity or explicit adult content only when all participants are adults, all required consent exists, and the content complies with law and PIROKA policies. Private content is never exempt from safety rules.`,
      },
      {
        heading: 'No commercial sexual services',
        body: `Do not use PIROKA to buy, sell, advertise, broker, solicit, or arrange prostitution or commercial sexual services, or to facilitate sexual exploitation or trafficking. This includes disguised or coded attempts to exchange sexual activity for money, goods, lodging, drugs, or other consideration.`,
      },
      {
        heading: 'Prohibited conduct',
        body: `Do not use PIROKA to harass, stalk, threaten, coerce, extort, dox, impersonate, scam, distribute malware, sell illegal drugs, facilitate unlawful weapons transactions, evade blocks or suspensions, scrape the service without authorization, systematically track another person's location, exploit a minor, distribute CSAM, distribute NCII, facilitate trafficking, or otherwise violate law or our policies.`,
      },
      {
        heading: 'Location-based service',
        body: `PIROKA may process device coordinates to provide map and nearby features. We are designed to show other users an approximate or privacy-adjusted representation rather than your raw device coordinates. Approximation reduces risk but cannot guarantee anonymity because other information, repeated observations, messages, photos, landmarks, or user behavior may allow someone to infer identity or location.`,
      },
      {
        heading: 'Moderation and enforcement',
        body: `We may investigate, remove content, reduce visibility, issue warnings, restrict features, suspend or terminate accounts, require verification, preserve evidence, block re-registration, or refer matters to authorities when reasonably necessary to enforce law or policy, protect users, prevent fraud, or secure the service. Serious safety violations may result in immediate action without a warning.`,
      },
      {
        heading: 'Appeals',
        body: `Eligible enforcement actions can be appealed through Account standing & appeals. Appeals are reviewed against the original rule and available evidence. We may withhold reporter identity, illegal material, security methods, or information that could endanger a person or interfere with an investigation.`,
      },
      {
        heading: 'Subscriptions and billing',
        body: `Paid features, if enabled, are governed by the Subscription & Billing Terms and the terms shown at checkout. Subscriptions renew automatically only after the renewal interval, price, and material terms are displayed and you provide the required authorization. You may cancel future renewal through the available account or payment-provider cancellation method. Billing may be unavailable while a payment provider is not commercially approved for PIROKA's use case.`,
      },
      {
        heading: 'Third-party services',
        body: `PIROKA depends on third-party infrastructure and services for hosting, database/storage, authentication, mapping or geocoding, communications, monitoring, support, and payments. Their availability and separate terms may affect parts of PIROKA. Our Privacy Policy identifies the material production data flows we currently use.`,
      },
      {
        heading: 'Offline meetings and safety',
        body: `You are responsible for your decisions before, during, and after meeting another user. PIROKA does not guarantee another person's identity, intent, safety, criminal history, or health claims. Use independent judgment, available blocking/reporting tools, and the Safety Center. PIROKA is not an emergency service.`,
      },
      {
        heading: 'Disclaimer',
        body: `To the maximum extent permitted by law, PIROKA is provided “as is” and “as available.” We do not guarantee uninterrupted operation, error-free service, the accuracy of user statements, the safety of offline encounters, perfect location privacy, or that all harmful conduct will be identified or prevented. Non-waivable consumer rights remain unaffected.`,
      },
      {
        heading: 'Limitation of liability',
        body: `To the maximum extent permitted by law, ${LEGAL_ENTITY_NAME} and its affiliates, owners, officers, employees, contractors, and service providers are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from PIROKA. Any limitation applies only to the extent permitted by applicable law and does not waive rights that cannot legally be waived.`,
      },
      {
        heading: 'Indemnification',
        body: `To the extent permitted by law, you agree to indemnify and hold ${LEGAL_ENTITY_NAME} harmless from third-party claims arising from your unlawful use of PIROKA, your User Content, your violation of these Terms, or your infringement of another person's rights. This does not require you to indemnify us for conduct for which the law does not permit indemnification.`,
      },
      {
        heading: 'Governing law and venue',
        body: `These Terms are governed by Delaware law, excluding conflict-of-law rules, except where non-waivable consumer law requires otherwise. A dispute not required by law to be heard elsewhere may be brought in a state or federal court with jurisdiction in Delaware. PIROKA does not currently rely on mandatory consumer arbitration in this version of the Terms.`,
      },
      {
        heading: 'Changes and contact',
        body: `We may update these Terms. Material changes may require notice or renewed acceptance when required. The operator is ${operator}. ${contacts}.`,
      },
    ],
  },

  billing: {
    title: 'Subscription & Billing Terms',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Paid features',
        body: `PIROKA may offer optional paid features. Paid checkout is available only when billing is enabled and the active payment provider is configured and authorized for PIROKA's business model.`,
      },
      {
        heading: 'Planned launch pricing',
        body: `The founder-approved launch pricing is $4.99 for 1 week, $9.99 for 1 month, $24.99 for 3 months, and $39.99 for 6 months, with no free trial. The price, duration, taxes, and renewal interval actually shown at checkout control the transaction. PIROKA will not activate a plan at a price or interval different from the checkout disclosure without the required authorization.`,
      },
      {
        heading: 'Automatic renewal',
        body: `Where a plan renews automatically, we display the material renewal terms before obtaining billing information, obtain the required express authorization, and provide a simple mechanism to stop future recurring charges. Your confirmation or receipt identifies the plan and renewal terms.`,
      },
      {
        heading: 'Cancellation',
        body: `You may cancel future renewal through the cancellation mechanism available in your PIROKA account or through the payment provider where applicable. Cancellation stops future renewal. Unless law requires otherwise, access to already-paid features may continue through the end of the paid period.`,
      },
      {
        heading: 'Refunds',
        body: `Completed subscription charges are generally non-refundable unless required by applicable law, the payment provider's rules, or a specific PIROKA refund commitment shown to you at purchase. We may issue discretionary credits or refunds.`,
      },
      {
        heading: 'Price changes',
        body: `We may change prices prospectively. When required, existing subscribers receive advance notice before a higher recurring price takes effect. A price change will not retroactively change a completed charge.`,
      },
      {
        heading: 'Payment processor',
        body: `PIROKA may use one or more third-party payment providers. A provider's technical integration does not guarantee permanent eligibility, and PIROKA may disable or replace a provider for policy, compliance, risk, or continuity reasons. Financial information may be processed directly by that provider under its own terms and privacy practices.`,
      },
      { heading: 'Billing support', body: `Billing questions: ${CONTACT_EMAIL.support}.` },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Who controls your information',
        body: `${LEGAL_ENTITY_NAME} operates PIROKA and determines how personal information described in this policy is used, except where a third party acts under its own independent legal obligations. Contact: ${CONTACT_EMAIL.privacy}. Notice address: ${LEGAL_NOTICE_ADDRESS}.`,
      },
      {
        heading: 'Information you provide',
        body: `We may process account identifiers, authentication data, email address, age confirmation and verification status, profile information, photos, bio, preferences, status or intent information, travel information, reports, support requests, and other content you choose to submit. Some information may reveal or permit inferences about sexual orientation, sex life, relationships, or other sensitive characteristics.`,
      },
      {
        heading: 'Location information',
        body: `When you allow location access, PIROKA may receive device coordinates to provide nearby and map features. We are designed to transform or reduce precision before exposing location to other users. We may also process place searches, approximate areas, travel locations, and related technical metadata.`,
      },
      {
        heading: 'Messages and private media',
        body: `One-to-one chat is designed to use end-to-end encrypted message content so the server stores ciphertext rather than readable message text. Other information such as conversation participants, timestamps, report evidence you intentionally submit, or non-E2E community content may still be processed for service operation, safety, and legal compliance.`,
      },
      {
        heading: 'Safety, moderation and fraud data',
        body: `We process reports, blocks, moderation actions, appeals, abuse evidence, security events, fraud signals, account status, verification results, and related records to keep PIROKA safe and enforce policy. Public report intake may collect a best-effort IP address and optional contact email for abuse prevention and follow-up.`,
      },
      {
        heading: 'Payments',
        body: `If paid features are enabled, PIROKA may receive transaction identifiers, subscription status, plan information, charge amount, currency, renewal/cancellation status, and limited billing metadata from the active payment provider. We do not intentionally require our application database to store complete payment-card numbers.`,
      },
      {
        heading: 'Device and technical data',
        body: `We may process IP address, browser, operating system, device information, authentication events, request logs, security events, crash/error information, push subscription data, and other diagnostics needed to operate and secure PIROKA.`,
      },
      {
        heading: 'How we use information',
        body: `We use information to authenticate users, provide profiles and discovery, operate map and messaging features, deliver private media, provide support, process subscriptions, send transactional communications, investigate reports, prevent fraud and abuse, enforce policy, secure the service, comply with law, answer legal requests, debug, measure performance, and improve PIROKA.`,
      },
      {
        heading: 'Sensitive information',
        body: `PIROKA may process information that some laws treat as sensitive, including precise geolocation, sexual-orientation or sex-life information, private communications, authentication credentials, and age/identity assurance results. We limit such processing to service delivery, safety, security, legal compliance, and other disclosed purposes.`,
      },
      {
        heading: 'Service providers and production stack',
        body: `PIROKA uses Vercel for hosting and delivery; Supabase for PostgreSQL, authentication infrastructure, realtime, and Storage; Google when you choose Google OAuth; MapLibre for map rendering; PostGIS for geospatial operations; geocoding services such as Photon or Nominatim when enabled; Resend or configured SMTP infrastructure for email delivery; Sentry when enabled for error monitoring; Zoho Desk when enabled for support; and a payment provider such as PayPal when billing is enabled. A component that is not enabled in production does not receive data merely because it is mentioned here.`,
      },
      {
        heading: 'Sharing',
        body: `We may disclose information to service providers acting for us, at your direction, to provide requested functionality, to investigate abuse or fraud, to protect people, to comply with valid legal process, or in connection with a merger, financing, acquisition, reorganization, or similar transaction subject to applicable law.`,
      },
      {
        heading: 'Sale, sharing and advertising',
        body: `PIROKA is not designed around selling sensitive profile, sexuality, private-message, or precise-location data. Whether a particular analytics or future advertising technology constitutes a “sale,” “sharing,” or targeted advertising under a state privacy law depends on the actual technology enabled. Our published notices and controls must be updated before activating any incompatible advertising or tracking use.`,
      },
      {
        heading: 'Age assurance',
        body: `PIROKA records the fact that an age check passed and the method used. Depending on the configured provider, the provider may process a selfie, ID, liveness signal, or related information. PIROKA is designed to avoid retaining the raw verification image or identity document itself when a provider can return only the verification result.`,
      },
      {
        heading: 'Retention',
        body: `We retain information only for as long as reasonably necessary for service delivery, safety, security, fraud prevention, legal obligations, disputes, accounting, and legitimate operations. The Data Retention Policy describes current targets and exceptions. Legal holds, safety evidence, and required financial records may be retained longer.`,
      },
      {
        heading: 'Your choices and rights',
        body: `PIROKA provides account deletion and data export functions. Depending on applicable law and your state, you may also have rights to access, correct, delete, obtain a portable copy, opt out of certain sale/sharing/targeted-advertising uses, limit certain sensitive-data uses, withdraw consent where applicable, or appeal a privacy-rights decision. Contact ${CONTACT_EMAIL.privacy} to exercise a right that is not available in-product.`,
      },
      {
        heading: 'Security',
        body: `We use technical and organizational safeguards appropriate to the information we process, including access controls and encryption mechanisms where implemented. No service can guarantee perfect security. Report suspected compromise to ${CONTACT_EMAIL.safety}.`,
      },
      {
        heading: 'Minors',
        body: `PIROKA is not directed to minors and no person under 18 may use the service. If we learn that a minor is using PIROKA, we may restrict or close the account, preserve information where legally required, and take child-safety actions under our Minor & CSAM Safety Policy.`,
      },
      { heading: 'Contact', body: `${operator}. Privacy: ${CONTACT_EMAIL.privacy}.` },
    ],
  },

  california: {
    title: 'California Privacy Notice',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Scope',
        body: `This notice supplements the Privacy Policy for California residents where the California Consumer Privacy Act, as amended, applies. PIROKA may voluntarily honor similar requests even where a statutory threshold is not met.`,
      },
      {
        heading: 'Categories collected',
        body: `PIROKA may process identifiers; account and customer records; commercial/subscription information; internet or electronic activity; geolocation; visual information; inferences; and sensitive personal information. Sensitive information may include precise geolocation, sexual-orientation or sex-life information, private communications, credentials, and age/identity-assurance information.`,
      },
      {
        heading: 'Sources and purposes',
        body: `Information may come from you, your device, authentication providers, payment providers, service providers, other users, safety investigations, and permitted third-party sources. We use it for authentication, service delivery, location-based discovery, communications, subscriptions, moderation, safety, security, fraud prevention, support, debugging, and legal compliance.`,
      },
      {
        heading: 'Disclosures',
        body: `We may disclose information to service providers supporting hosting, database/storage, authentication, payments, email, monitoring, support, mapping/geocoding, safety, and legal compliance. We do not authorize unrestricted use of sensitive PIROKA data for unrelated third-party purposes.`,
      },
      {
        heading: 'California rights',
        body: `Where applicable, California residents may request access/knowledge, correction, deletion, portability, information about categories collected or disclosed, opt-out of sale or sharing, limitation of certain sensitive-personal-information uses, and non-discrimination for exercising privacy rights. Requests may be sent to ${CONTACT_EMAIL.privacy}. We may verify identity and authorized-agent authority before completing a request.`,
      },
      {
        heading: 'Global Privacy Control',
        body: `Where applicable law requires recognition of a legally valid opt-out preference signal such as Global Privacy Control, PIROKA will process that signal for the browser or device as required by the technology actually enabled on the service.`,
      },
    ],
  },

  location: {
    title: 'Location Privacy & Safety',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Why PIROKA uses location',
        body: `PIROKA may process precise device coordinates to calculate nearby results, map position, distance, Places, and safety-related functionality. The service is designed so raw device coordinates are not intentionally returned to other users.`,
      },
      {
        heading: 'Approximation and inference',
        body: `Public-facing positions may be rounded, fuzzed, generalized, delayed, or otherwise transformed. These controls reduce exposure but cannot prevent inference from repeated observations, landmarks, profile details, photos, chat, or behavior.`,
      },
      {
        heading: 'Retention',
        body: `PIROKA is designed not to create a permanent movement-history product by default. Current-location records should expire or be replaced when no longer needed. Security, abuse, legal, or user-requested features may justify limited exceptions.`,
      },
      {
        heading: 'Blocking and visibility',
        body: `Blocking is a safety control. PIROKA is designed to prevent ordinary profile, map, nearby, and messaging visibility between blocked users. Location privacy must not depend on a paid subscription.`,
      },
      {
        heading: 'Travel and home safety',
        body: `Travel Mode may represent a selected area rather than your actual current location. Avoid publishing an exact home address or identifying landmarks unless you intend to share them. Use the strongest location-privacy setting appropriate to your circumstances.`,
      },
    ],
  },

  deletion: {
    title: 'Account Deletion & Data Rights',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Delete your account',
        body: `Authenticated users can initiate deletion from account privacy settings. PIROKA removes the active user record and related live-service data according to the database relationships and storage cleanup implemented by the service, then removes the authentication account. Deletion is not reversible.`,
      },
      {
        heading: 'Information that may remain',
        body: `Deletion does not require us to erase information that applicable law permits or requires us to retain for safety, fraud prevention, ban evasion, accounting, tax, disputes, legal holds, regulatory compliance, security, or enforcement of legal rights. Where appropriate, retained records are minimized or detached from the deleted profile.`,
      },
      {
        heading: 'Export and other rights',
        body: `PIROKA provides a data-export function for account-linked information available to the service. Some encrypted content may not be readable by the server and may therefore not appear in a server-side export. Requests for correction, access, portability, or other applicable privacy rights may be sent to ${CONTACT_EMAIL.privacy}.`,
      },
    ],
  },

  cookies: {
    title: 'Cookie & Tracking Notice',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Necessary storage',
        body: `PIROKA uses cookies or browser storage needed for authentication, sessions, security, fraud prevention, user preferences, and core functionality.`,
      },
      {
        heading: 'Analytics and diagnostics',
        body: `PIROKA may use first-party or service-provider analytics and diagnostics to understand product performance and errors. The actual production configuration controls which providers receive data.`,
      },
      {
        heading: 'Advertising',
        body: `PIROKA does not treat future advertising or retargeting technology as automatically authorized. If cross-context behavioral advertising or similar tracking is introduced, this notice, the Privacy Policy, and any legally required consent or opt-out controls must be updated before activation.`,
      },
    ],
  },

  retention: {
    title: 'Data Retention Policy',
    meta: 'Operational targets · October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Location',
        body: `Current location is intended to be short-lived rather than a permanent history. The existing data model is designed around expiring current-location records on an approximately 24-hour basis. Raw precise coordinates should be processed transiently where feasible and not exposed to other users.`,
      },
      {
        heading: 'Account and content',
        body: `Active account/profile data is kept while the account is active. Deleted-account information is removed or anonymized according to implemented deletion workflows, subject to backups, safety evidence, fraud controls, disputes, and legal obligations.`,
      },
      {
        heading: 'Safety and enforcement',
        body: `Reports, appeals, moderation actions, fraud signals, and security evidence may be retained longer than ordinary profile data when reasonably necessary to protect users, prevent repeat abuse, respond to legal process, or document enforcement.`,
      },
      {
        heading: 'Financial and legal records',
        body: `Payment, tax, accounting, consent, and legal records may be retained for periods required or reasonably justified by applicable law, contracts, disputes, and recordkeeping obligations.`,
      },
      {
        heading: 'Backups and legal holds',
        body: `Deleted data may persist temporarily in encrypted backups until the relevant backup cycle expires. A legal hold, safety investigation, or preservation obligation may suspend normal deletion for the affected records.`,
      },
    ],
  },

  automation: {
    title: 'Automated Moderation Disclosure',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'How automation may be used',
        body: `PIROKA may use automated systems to detect or prioritize possible spam, scams, account compromise, prohibited solicitation, ban evasion, unsafe behavior, minor/age risk, policy violations, or other abuse signals.`,
      },
      {
        heading: 'Limits',
        body: `Automated systems can make mistakes and do not guarantee harmful content will be detected. Automation does not mean every private message is manually reviewed or that PIROKA can read end-to-end encrypted message content.`,
      },
      {
        heading: 'Human review and appeals',
        body: `Automated signals may lead to temporary restrictions or human review. Significant enforcement decisions can be appealed where eligible. PIROKA may use specialized third-party tools only after the related privacy data flow is approved and disclosed.`,
      },
    ],
  },

  guidelines: {
    title: 'Community Guidelines',
    meta: 'Updated October 24, 2026',
    draft: false,
    sections: [
      { heading: 'Adults only', body: `Everyone on PIROKA must be 18+. Report a suspected minor immediately.` },
      {
        heading: 'Consent first',
        body: `Consent must be voluntary, specific, informed, ongoing, and revocable. Silence is not consent. Past consent is not future consent. Consent to meet is not consent to sex; consent to sex is not consent to record; consent to record is not consent to share.`,
      },
      {
        heading: 'Respect boundaries',
        body: `Stop contact when someone asks you to stop, blocks you, or clearly withdraws consent. Do not evade blocks, stalk, threaten, coerce, extort, or expose another person's private information or location.`,
      },
      {
        heading: 'Be authentic',
        body: `Do not impersonate another person, use stolen photos, run scams, misrepresent verification, or create accounts to evade enforcement.`,
      },
      {
        heading: 'No commercial sex or trafficking',
        body: `PIROKA is not a marketplace for prostitution or commercial sexual services. Solicitation, brokering, trafficking, coercive recruitment, and coded attempts to arrange commercial sex are prohibited.`,
      },
      {
        heading: 'No illegal drug sales or arrangements',
        body: `Do not buy, sell, offer, distribute, or arrange illegal drugs through PIROKA. Harm-reduction information may be permitted when it does not facilitate illegal transactions.`,
      },
      {
        heading: 'Enforcement',
        body: `Depending on severity and history, PIROKA may educate, warn, remove content, restrict features, suspend, terminate, require verification, preserve evidence, or refer matters to authorities. Serious safety violations may skip earlier steps.`,
      },
    ],
  },

  aup: {
    title: 'Acceptable Use Policy',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Illegal and harmful activity',
        body: `Do not use PIROKA to violate law, exploit a minor, groom, create or distribute CSAM, facilitate trafficking, solicit prostitution, distribute NCII, stalk, threaten, extort, dox, impersonate, defraud, sell illegal drugs, facilitate unlawful weapons transactions, or promote serious violent crime.`,
      },
      {
        heading: 'Platform abuse',
        body: `Do not scrape, crawl, reverse engineer, overload, bypass security, evade enforcement, distribute malware, spam, harvest data, automate unauthorized accounts, or systematically monitor another person's location without authorization.`,
      },
      {
        heading: 'Commercial activity',
        body: `Unauthorized commercial solicitation, advertising, lead generation, paid sexual services, and resale of access or data are prohibited unless PIROKA expressly authorizes the activity.`,
      },
      {
        heading: 'Enforcement',
        body: `PIROKA may act based on content, context, intent, pattern, severity, repeat behavior, legal requirements, and risk to users or the service.`,
      },
    ],
  },

  content: {
    title: 'Content Policy',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Public profiles and public surfaces',
        body: `Non-explicit adult nudity may be allowed subject to context. Visible genitals, masturbation, intercourse, oral sex, penetration, ejaculation, and explicit sexual acts are prohibited on public-facing surfaces.`,
      },
      {
        heading: 'Private albums and private messages',
        body: `Private albums may include visible adult genitals, and consenting adult members may exchange lawful explicit content privately. Every depicted person must be 18+, the uploader must have the required rights and consent, and the content must comply with all PIROKA rules.`,
      },
      {
        heading: 'Prohibited everywhere',
        body: `Minors, CSAM, grooming, NCII, sextortion, hidden-camera intimate media, sexual assault, coercion, trafficking, prostitution, bestiality, necrophilia, content involving a person unable to consent, unlawfully obtained intimate content, and other illegal sexual material are prohibited everywhere on PIROKA.`,
      },
      {
        heading: 'AI-generated intimate content',
        body: `Sexual deepfakes or other synthetic intimate depictions of an identifiable real person without consent are prohibited. Sexualized synthetic content depicting or appearing to depict a minor is prohibited.`,
      },
    ],
  },

  safety: {
    title: 'Safety Center',
    meta: 'Tools and guidance',
    draft: false,
    sections: [
      {
        heading: 'Before meeting',
        body: `Use independent judgment. Consider video chat or other verification appropriate to your circumstances, meet somewhere you can leave easily, maintain your own transportation, and consider telling a trusted person where you are going.`,
      },
      {
        heading: 'Location and privacy',
        body: `Avoid sharing your exact home address until you intend to. Faces, tattoos, street signs, plates, landmarks, and photo metadata can reveal identity or location. Location approximation reduces risk but does not guarantee anonymity.`,
      },
      {
        heading: 'Consent and substances',
        body: `Consent can be withdrawn at any time. A person who is unconscious, incapacitated, coerced, or otherwise unable to consent cannot consent. Be cautious with substances that impair judgment, never tamper with another person's drink or drugs, and contact emergency services for an overdose or immediate danger.`,
      },
      {
        heading: 'Scams',
        body: `Do not send gift cards, cryptocurrency, passwords, banking credentials, verification codes, or money to a stranger based solely on a PIROKA interaction.`,
      },
      {
        heading: 'If something goes wrong',
        body: `Block and report from the relevant profile or chat, or use the public Report or request removal page. For immediate danger, contact local emergency services first. PIROKA is not an emergency response service.`,
      },
    ],
  },

  removal: {
    title: 'Content Removal Policy',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'What you can report',
        body: `You can request review of content that may be illegal, non-consensual, infringing, impersonating, exploitative, threatening, or otherwise prohibited by PIROKA policy. You do not need an account to use the public report form.`,
      },
      {
        heading: 'What to include',
        body: `Provide the profile or content location if known, what happened, why you believe removal is appropriate, and a contact email if you want follow-up. Do not send unnecessary copies of suspected CSAM.`,
      },
      {
        heading: 'Review and action',
        body: `PIROKA may preserve evidence, temporarily restrict content, request more information, investigate related accounts, remove or disable content, restrict an account, refer a matter to authorities where required, or decline a request that lacks a sufficient basis.`,
      },
      {
        heading: 'Specialized requests',
        body: `NCII requests are handled under the NCII policy. Copyright notices are handled under the Copyright / DMCA Policy. Suspected child exploitation is handled under the Minor & CSAM Safety Policy.`,
      },
    ],
  },

  'appeals-policy': {
    title: 'Appeals Policy',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Eligible actions',
        body: `A user may appeal an eligible warning, feature limitation, suspension, removal, or other moderation action associated with an action identifier shown by PIROKA.`,
      },
      {
        heading: 'How to appeal',
        body: `Use Account standing & appeals. If you are signed in, PIROKA can match the action to your account. If a suspension or removal prevents sign-in, submit the moderation action ID and the email associated with that account. Identify the action and explain why the decision should be changed. One pending appeal is permitted per moderation action unless PIROKA reopens the matter.`,
      },
      {
        heading: 'Review',
        body: `PIROKA reviews the original action, applicable rule, available evidence, and the information submitted in the appeal. Where operationally practicable, a reviewer should not be the sole person responsible for the original final action.`,
      },
      {
        heading: 'Safety limitations',
        body: `We may withhold reporter identity, sensitive abuse-detection methods, illegal material, or investigative details where disclosure could endanger a person, facilitate evasion, or interfere with law enforcement.`,
      },
    ],
  },

  ncii: {
    title: 'NCII / Intimate Image Removal',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Zero tolerance for NCII',
        body: `PIROKA prohibits non-consensual intimate imagery, including qualifying authentic or digitally created intimate images distributed without valid consent.`,
      },
      {
        heading: 'How to request removal',
        body: `Use Report or request removal and select “Shared without consent.” Provide enough information to identify the depicted person, locate the content, and explain that the distribution was non-consensual. A contact email is strongly recommended for follow-up.`,
      },
      {
        heading: '48-hour federal process',
        body: `For a valid request covered by the federal TAKE IT DOWN Act, PIROKA will remove or disable access to the reported intimate image and known identical copies as required within 48 hours. We may preserve tightly restricted evidence where lawfully necessary for safety, legal process, or repeat-abuse investigation.`,
      },
      {
        heading: 'Retaliation and abuse',
        body: `Retaliation against a person for a good-faith NCII request is prohibited. Fraudulent or abusive removal requests may themselves result in enforcement.`,
      },
    ],
  },

  minors: {
    title: 'Minor & CSAM Safety Policy',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: '18+ only',
        body: `PIROKA is exclusively for adults 18 and older. Minors, adults facilitating minor access, grooming, sexualization of minors, CSAM, requests for CSAM, and links or instructions intended to obtain CSAM are prohibited.`,
      },
      {
        heading: 'Suspected minor account',
        body: `PIROKA may immediately restrict discovery and messaging, hide the account, preserve relevant evidence, require stronger age verification, or close the account when an underage-user risk is reported or otherwise detected.`,
      },
      {
        heading: 'Suspected CSAM',
        body: `Do not download, forward, duplicate, or redistribute suspected CSAM merely to report it. Use PIROKA's reporting process and provide location information sufficient for trained personnel to review the matter safely.`,
      },
      {
        heading: 'NCMEC reporting',
        body: `When the federal provider-reporting obligation is triggered by actual knowledge of qualifying facts or circumstances, PIROKA will report to NCMEC's CyberTipline as required by 18 U.S.C. § 2258A. Federal law does not require PIROKA to monitor every user or affirmatively scan every private communication merely because this reporting duty exists.`,
      },
    ],
  },

  trafficking: {
    title: 'Exploitation & Commercial Sex Policy',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Prohibited activity',
        body: `PIROKA prohibits prostitution, solicitation for prostitution, brokering commercial sexual services, sex trafficking, recruitment for exploitation, pimping, coercion, sex-for-money arrangements, and coded attempts to evade these rules.`,
      },
      {
        heading: 'Enforcement',
        body: `Credible trafficking or exploitation indicators may result in immediate restriction, evidence preservation, investigation of related accounts, termination, and reporting or cooperation with law enforcement where legally appropriate.`,
      },
      {
        heading: 'Adult social interaction',
        body: `Consensual adult social or sexual conversation is not automatically commercial sex. PIROKA evaluates context, consideration, solicitation, pattern, and other evidence before enforcing this policy.`,
      },
    ],
  },

  dmca: {
    title: 'Copyright / DMCA Policy',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Copyright notices',
        body: `Send copyright notices to ${CONTACT_EMAIL.dmca} and ${LEGAL_ENTITY_NAME}, ${LEGAL_NOTICE_ADDRESS}. A notice should include the information required by 17 U.S.C. § 512(c)(3), including a signature, identification of the copyrighted work, identification and location of the material, contact information, a good-faith statement, and the required accuracy/authority statement under penalty of perjury.`,
      },
      {
        heading: 'Counter-notices',
        body: `If PIROKA removes material after a copyright notice, the affected user may send a counter-notice to ${CONTACT_EMAIL.dmca} containing the information required by 17 U.S.C. § 512(g), including identification of the removed material, the required statement under penalty of perjury, contact information, consent to the applicable federal-court jurisdiction, and acceptance of service of process.`,
      },
      {
        heading: 'Repeat infringers',
        body: `PIROKA may terminate repeat copyright infringers in appropriate circumstances and may restore material after a valid counter-notice when the law permits and the claimant does not timely notify us of a qualifying court action.`,
      },
      {
        heading: 'Designated agent registration',
        body: `PIROKA publishes ${CONTACT_EMAIL.dmca} as its copyright-contact mailbox. Separate registration of XRMG's designated DMCA agent with the U.S. Copyright Office is an operational compliance requirement and must be maintained outside the application code.`,
      },
    ],
  },

  'legal-requests': {
    title: 'Legal & Law-Enforcement Requests',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'Where to send requests',
        body: `Legal process may be sent to ${CONTACT_EMAIL.legal} and ${LEGAL_ENTITY_NAME}, ${LEGAL_NOTICE_ADDRESS}. Requests should identify the requesting authority, legal basis, account identifiers, specific records sought, and relevant date range.`,
      },
      {
        heading: 'Review',
        body: `We may authenticate a request, seek clarification, reject defective process, narrow an overbroad request, preserve records, challenge a request where appropriate, or produce information that we are legally required to disclose.`,
      },
      {
        heading: 'User notice',
        body: `We may notify an affected user unless notice is prohibited by law or would create a material safety risk, compromise an investigation, or otherwise be inappropriate.`,
      },
      {
        heading: 'Emergency requests',
        body: `An authorized government or law-enforcement official requesting emergency disclosure based on imminent danger of death or serious physical injury should clearly mark the request EMERGENCY and provide facts sufficient for PIROKA to evaluate the request and verify the requester's authority.`,
      },
    ],
  },

  '2257': {
    title: '18 U.S.C. §§ 2257 / 2257A Notice',
    meta: 'Last updated October 24, 2026',
    draft: false,
    sections: [
      {
        heading: 'User-generated content model',
        body: `PIROKA is designed as a platform for user-generated content and does not commission users to create sexually explicit depictions for PIROKA. Users remain responsible for complying with recordkeeping duties that may apply to content they create or distribute.`,
      },
      {
        heading: 'Age and consent requirements',
        body: `PIROKA requires adult-only use and prohibits content involving minors. Users submitting intimate content represent that every depicted person was an adult when the material was created and that the uploader has the rights and consent required to share it.`,
      },
      {
        heading: 'No blanket exemption claim',
        body: `This notice does not claim that every activity or item of content is exempt from 18 U.S.C. §§ 2257, 2257A, or 28 C.F.R. Part 75. Where those rules apply to ${LEGAL_ENTITY_NAME} or a user, the applicable obligations remain in force. Compliance questions may be sent to ${CONTACT_EMAIL.compliance}.`,
      },
    ],
  },
} as const;

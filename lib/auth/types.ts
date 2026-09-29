export type AuthProvider = 'google' | 'apple' | 'email' | 'anonymous';

/** The only session facts the app needs. Never carries raw location, never the age itself. */
export type Session = {
  userId: string;
  provider: AuthProvider;
  email: string | null;
  anonymous: boolean;
  /** Both consent checkboxes accepted (ISO timestamp) — required before the age check. */
  consentAt: string | null;
  /** The single boolean we store about age. */
  ageVerified: boolean;
  /** How the age check was passed; informational only. */
  ageMethod: 'face' | 'id' | null;
};

export type AuthMode = 'supabase' | 'demo';

/** Where the gate sends people who are signed in but not yet allowed in. */
export const GATE_PATH = '/?gate=1';
export const AFTER_GATE_PATH = '/onboarding';
export const APP_PATH = '/app/map';

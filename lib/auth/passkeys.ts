import 'server-only';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/db/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createSupabase } from '@/lib/supabase/server';
import { appUrl } from '@/lib/app-url';

/**
 * Passkeys (Face ID, Touch ID, Android fingerprint) as a primary sign-in.
 *
 * Registration requires an existing session. Sign-in uses discoverable credentials, so the browser
 * offers the right passkey without asking for an email. After the assertion verifies, the server
 * mints a normal Supabase session for that user (admin magic-link token, redeemed server-side), so
 * the rest of the app sees an ordinary signed-in user.
 */

const RP_NAME = 'πroka';

/** Registrable domain, so a passkey made on www works on the apex and vice versa. */
export function rpID(): string {
  if (process.env.PASSKEY_RP_ID) return process.env.PASSKEY_RP_ID;
  const host = new URL(appUrl()).hostname;
  return host.startsWith('www.') ? host.slice(4) : host;
}

function expectedOrigins(): string[] {
  const id = rpID();
  if (id === 'localhost') return ['http://localhost:3000', 'http://localhost:3101'];
  return [`https://${id}`, `https://www.${id}`];
}

const b64url = (u: Uint8Array) => Buffer.from(u).toString('base64url');
const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

type Fail = { ok: false; reason: string };

async function saveChallenge(kind: 'register' | 'authenticate', challenge: string, userId: string | null) {
  const db = supabaseAdmin!;
  // Opportunistic cleanup of expired challenges.
  void db.from('webauthn_challenges').delete().lt('expires_at', new Date().toISOString());
  const { data, error } = await db
    .from('webauthn_challenges')
    .insert({ kind, challenge, user_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Single use: the row is deleted as it is read. */
async function takeChallenge(id: string, kind: 'register' | 'authenticate', userId: string | null) {
  const db = supabaseAdmin!;
  let q = db
    .from('webauthn_challenges')
    .delete()
    .eq('id', id)
    .eq('kind', kind)
    .gt('expires_at', new Date().toISOString());
  q = userId ? q.eq('user_id', userId) : q.is('user_id', null);
  const { data } = await q.select('challenge');
  return (data?.[0]?.challenge as string | undefined) ?? null;
}

export async function registrationOptions(userId: string, label: string) {
  const db = supabaseAdmin!;
  const { data: existing } = await db.from('passkeys').select('id, transports').eq('user_id', userId);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(),
    userName: label,
    userDisplayName: label,
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    excludeCredentials: (existing ?? []).map((p) => ({
      id: p.id as string,
      transports: (p.transports ?? []) as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  const challengeId = await saveChallenge('register', options.challenge, userId);
  return { options, challengeId };
}

export async function verifyRegistration(
  userId: string,
  challengeId: string,
  response: RegistrationResponseJSON,
  label: string | null,
): Promise<{ ok: true } | Fail> {
  const challenge = await takeChallenge(challengeId, 'register', userId);
  if (!challenge) return { ok: false, reason: 'Setup expired. Try again.' };
  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigins(),
      expectedRPID: rpID(),
      requireUserVerification: true,
    });
  } catch {
    return { ok: false, reason: 'Could not verify this device.' };
  }
  if (!result.verified) return { ok: false, reason: 'Could not verify this device.' };
  const info = result.registrationInfo;
  const { error } = await supabaseAdmin!.from('passkeys').insert({
    id: info.credential.id,
    user_id: userId,
    public_key: b64url(info.credential.publicKey),
    counter: info.credential.counter,
    transports: info.credential.transports ?? response.response.transports ?? [],
    device_type: info.credentialDeviceType,
    backed_up: info.credentialBackedUp,
    label: label?.slice(0, 60) ?? null,
  });
  if (error) return { ok: false, reason: 'This passkey is already registered.' };
  return { ok: true };
}

export async function authenticationOptions() {
  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: 'required',
    allowCredentials: [],
  });
  const challengeId = await saveChallenge('authenticate', options.challenge, null);
  return { options, challengeId };
}

export async function verifyAuthentication(
  challengeId: string,
  response: AuthenticationResponseJSON,
): Promise<{ ok: true; userId: string } | Fail> {
  const challenge = await takeChallenge(challengeId, 'authenticate', null);
  if (!challenge) return { ok: false, reason: 'Sign-in expired. Try again.' };
  const db = supabaseAdmin!;
  const { data: pk } = await db
    .from('passkeys')
    .select('id, user_id, public_key, counter, transports')
    .eq('id', response.id)
    .maybeSingle();
  if (!pk) return { ok: false, reason: 'This Face ID is not linked to a πroka account.' };

  let result;
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigins(),
      expectedRPID: rpID(),
      requireUserVerification: true,
      credential: {
        id: pk.id as string,
        publicKey: fromB64url(pk.public_key as string),
        counter: Number(pk.counter),
        transports: (pk.transports ?? []) as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    return { ok: false, reason: 'Could not verify Face ID.' };
  }
  if (!result.verified) return { ok: false, reason: 'Could not verify Face ID.' };
  await db
    .from('passkeys')
    .update({ counter: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', pk.id);
  return { ok: true, userId: pk.user_id as string };
}

/**
 * Starts a real Supabase session for `userId` in this response's cookies. Supabase has no
 * "create session" admin call, so we issue a magic-link token with the service role and redeem it
 * here on the server; nothing is emailed. Anonymous users get a private placeholder address on
 * auth.users only (never copied to public.users, so it receives no mail).
 */
export async function startSessionFor(userId: string): Promise<{ ok: true } | Fail> {
  const admin = createAdminClient();
  const sb = createSupabase();
  if (!admin || !sb) return { ok: false, reason: 'Sign-in is not configured.' };

  const { data: u, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !u.user) return { ok: false, reason: 'Account not found.' };
  if (u.user.banned_until && new Date(u.user.banned_until) > new Date())
    return { ok: false, reason: 'This account is suspended.' };

  let email = u.user.email;
  if (!email) {
    email = `${userId}@passkey.${rpID()}`;
    const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (error) return { ok: false, reason: 'Could not start the session.' };
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) return { ok: false, reason: 'Could not start the session.' };

  const { error: otpErr } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (otpErr) return { ok: false, reason: 'Could not start the session.' };
  return { ok: true };
}

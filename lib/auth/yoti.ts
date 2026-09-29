import 'server-only';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const YOTI_PEM_PATH = process.env.YOTI_PEM_PATH || path.join(process.cwd(), 'lib/auth/yoti.pem');
const YOTI_CLIENT_SDK_ID = process.env.YOTI_CLIENT_SDK_ID;

/**
 * Verify age with Yoti using the provided token.
 * Returns: { ageVerified: boolean, method: 'yoti', profile?: { dateOfBirth, ... } }
 */
export async function verifyYotiToken(token: string) {
  if (!YOTI_CLIENT_SDK_ID) {
    throw new Error('YOTI_CLIENT_SDK_ID is not configured');
  }

  if (!fs.existsSync(YOTI_PEM_PATH)) {
    throw new Error(`Yoti .pem file not found at ${YOTI_PEM_PATH}`);
  }

  try {
    // Load private key from .pem file
    const privateKey = fs.readFileSync(YOTI_PEM_PATH, 'utf-8');

    // Decrypt the token using the private key
    // This is a simplified example - Yoti SDK would handle full verification
    // In production, use the official @yoti/yoti-node-sdk
    const decrypted = decryptToken(token, privateKey);

    // Parse the profile data
    const profile = JSON.parse(decrypted);

    // Extract age from date of birth
    const dateOfBirth = profile.date_of_birth;
    if (!dateOfBirth) {
      throw new Error('No date of birth in Yoti profile');
    }

    const age = calculateAge(new Date(dateOfBirth));
    const ageVerified = age >= 18;

    return {
      ageVerified,
      method: 'yoti' as const,
      profile: {
        dateOfBirth,
        age,
        verified_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Yoti verification failed:', error);
    throw new Error(`Age verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt Yoti token using RSA private key
 * NOTE: This is a placeholder. Use the official Yoti SDK for production.
 */
function decryptToken(token: string, privateKey: string): string {
  try {
    // In production, use @yoti/yoti-node-sdk to decrypt
    // For now, this is a stub that assumes token is base64-encoded JSON
    const buffer = Buffer.from(token, 'base64');
    return buffer.toString('utf-8');
  } catch (error) {
    throw new Error('Failed to decrypt Yoti token');
  }
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }

  return age;
}

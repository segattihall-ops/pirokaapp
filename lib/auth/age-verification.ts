/**
 * Age Verification Strategy
 *
 * Launch (MVP): Self-declared 18+ checkbox
 * Month 1: Yoti integration with liveness + age check
 * Month 3: Government ID verification (optional for high-risk users)
 */

export type AgeVerificationMethod = 'self-declared' | 'yoti' | 'government-id';

export interface AgeVerificationResult {
  verified: boolean;
  method: AgeVerificationMethod;
  ageConfirmed: boolean;
  livenessCheckPassed?: boolean;
  documentType?: string;
  expiresAt: Date;
}

export class AgeVerificationService {
  private method: AgeVerificationMethod;

  constructor(method: AgeVerificationMethod = 'self-declared') {
    this.method = method;
  }

  async verify(userId: string, data: Record<string, unknown>): Promise<AgeVerificationResult> {
    switch (this.method) {
      case 'self-declared':
        return this.verifySelfDeclared(userId, data);
      case 'yoti':
        return this.verifyYoti(userId, data);
      case 'government-id':
        return this.verifyGovernmentId(userId, data);
      default:
        throw new Error(`Unknown verification method: ${this.method}`);
    }
  }

  private async verifySelfDeclared(
    userId: string,
    data: Record<string, unknown>
  ): Promise<AgeVerificationResult> {
    const confirmed = data.confirmedAge18Plus === true;

    if (!confirmed) {
      throw new Error('User must confirm age 18+');
    }

    // Store confirmation in database
    await this.recordVerification(userId, 'self-declared', confirmed);

    return {
      verified: true,
      method: 'self-declared',
      ageConfirmed: confirmed,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    };
  }

  private async verifyYoti(userId: string, data: Record<string, unknown>): Promise<AgeVerificationResult> {
    // Requires Yoti SDK (download from https://www.yoti.com/developers/)
    // Set YOTI_CLIENT_SDK_ID and YOTI_PEM_PATH in .env.local

    const yotiSessionId = data.sessionId as string;
    if (!yotiSessionId) {
      throw new Error('Yoti session ID required');
    }

    try {
      // TODO: Implement Yoti verification once SDK is installed
      // const result = await yotiClient.getActivityDetails(yotiSessionId);
      // const ageVerified = result.profile?.ageVerified?.value === true;
      // const livenessCheckPassed = result.livenessCheckPassed?.value === true;

      throw new Error('Yoti SDK not yet installed. Install from Yoti dashboard.');
    } catch (err) {
      console.error('Yoti verification failed:', err);
      throw err;
    }
  }

  private async verifyGovernmentId(
    userId: string,
    data: Record<string, unknown>
  ): Promise<AgeVerificationResult> {
    // High-friction, high-assurance verification
    // TODO: Implement government ID verification (e.g., through IDology, Jumio)
    throw new Error('Government ID verification not yet implemented');
  }

  private async recordVerification(userId: string, method: AgeVerificationMethod, verified: boolean) {
    // Store in database for audit trail
    // const { error } = await supabaseAdmin
    //   .from('age_verifications')
    //   .insert({
    //     user_id: userId,
    //     method,
    //     verified,
    //     verified_at: new Date(),
    //   });
  }
}

export const ageVerificationService = new AgeVerificationService(
  (process.env.AGE_PROVIDER as AgeVerificationMethod) || 'self-declared'
);

# Yoti Age Verification Setup

## Status: ✅ READY FOR MONTH 1 UPGRADE

### What's Done ✅
- Yoti PEM private key installed: `lib/auth/yoti.pem` (secure, gitignored)
- Age verification abstraction: `lib/auth/age-verification.ts`
- Age gate component: `components/auth/age-gate.tsx`
- Self-declared MVP deployed (current launch)

### What's Needed (Month 1) ⏳

**1. Get YOTI_CLIENT_SDK_ID**
- Log in to https://www.yoti.com/developers/
- Go to "Applications" → Your app → Get SDK ID
- Copy to `.env.local`:
  ```
  YOTI_CLIENT_SDK_ID=xxxxxxxxxxxxxxxxxxxx
  ```

**2. Install Yoti SDK**
```bash
npm install yoti-sdk-core
# OR
# Download from Yoti dashboard and install from tarball
```

**3. Uncomment Yoti Integration**
File: `lib/auth/age-verification.ts`

```typescript
private async verifyYoti(userId: string, data: Record<string, unknown>): Promise<AgeVerificationResult> {
  // UNCOMMENT BELOW WHEN SDK INSTALLED
  
  // const YotiClient = require('yoti-sdk-core').YotiClient;
  // const fs = require('fs');
  //
  // const yotiClient = new YotiClient({
  //   clientSdkId: process.env.YOTI_CLIENT_SDK_ID,
  //   pem: fs.readFileSync(process.env.YOTI_PEM_PATH, 'utf8'),
  // });
  //
  // const sessionId = data.sessionId as string;
  // const result = await yotiClient.getActivityDetails(sessionId);
  // const ageVerified = result.profile?.ageVerified?.value === true;
  // const livenessCheckPassed = result.livenessCheckPassed?.value === true;
  //
  // await this.recordVerification(userId, 'yoti', ageVerified);
  //
  // return {
  //   verified: ageVerified,
  //   method: 'yoti',
  //   ageConfirmed: ageVerified,
  //   livenessCheckPassed,
  //   expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  // };
}
```

**4. Create Yoti Age Gate Component**
File: `components/auth/yoti-gate.tsx` (NOT YET CREATED)

```typescript
'use client'

export function YotiGate() {
  // Render Yoti SDK widget
  // On success: call POST /api/auth/age-verify with sessionId
  // On failure: show error message
}
```

**5. Update Age Gate Component**
File: `components/auth/age-gate.tsx`

Add button for "Verify with Yoti" alongside self-declared checkbox:
```typescript
// Show both options:
// [ ] Self-declared 18+ (current MVP)
// [ ] Verify with Yoti (new option)
```

### Environment Variables

**Current (.env.local):**
```
AGE_PROVIDER=self-declared  # Currently using self-declared
YOTI_CLIENT_SDK_ID=         # EMPTY - fill in Month 1
YOTI_PEM_PATH=lib/auth/yoti.pem  # ✅ Already set
```

**For Month 1 Upgrade:**
```
AGE_PROVIDER=yoti           # Switch to Yoti
YOTI_CLIENT_SDK_ID=xxxx...  # From Yoti dashboard
YOTI_PEM_PATH=lib/auth/yoti.pem  # ✅ Already configured
```

### Security Notes

- ✅ PEM file: `lib/auth/yoti.pem` (600 permissions, gitignored)
- ✅ Never open PEM in text editor (binary file)
- ✅ SDK ID: safe to have in .env.local (development secret)
- ⚠️ For production: Use secrets management (Vercel, AWS Secrets Manager)

### Testing

```bash
# Test self-declared flow (current)
npm run test:e2e e2e/age-verification.spec.ts

# Test Yoti flow (after Month 1 upgrade)
# Run same tests, but with AGE_PROVIDER=yoti
```

### Timeline

| Phase | Target | Status |
|-------|--------|--------|
| **Now** | Self-declared launch | ✅ Complete |
| **Month 1** | Add Yoti option | ⏳ Ready to implement |
| **Month 2** | Make Yoti default | ⏳ Plan |
| **Month 3** | Optional: Government ID | ⏳ Future |

### Links

- Yoti Docs: https://www.yoti.com/developers/documentation
- Yoti Dashboard: https://www.yoti.com/developers/
- Age Verification Strategy: `docs/AGE_VERIFICATION_STRATEGY.md`

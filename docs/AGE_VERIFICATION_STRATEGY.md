# Age Verification Strategy

## Timeline

### **Phase 1: Launch (MVP)** — Self-Declared 18+
- User clicks checkbox: "I confirm I am 18+"
- Stored in `users.age_verified` with method `self-declared`
- **Compliance:** Legal confirmation recorded in audit log
- **Risk:** User can misrepresent age (low friction for onboarding)
- **Timeline:** NOW (ready for launch)

### **Phase 2: Month 1-2** — Yoti Liveness Check
- Integrate Yoti SDK (requires download from Yoti dashboard)
- User selects "Verify with Yoti" on signup
- Yoti performs:
  - Liveness check (selfie proves real person)
  - Age estimation (optional)
  - Document scan (optional)
- Seamless upgrade: users can still use self-declared, but Yoti option available
- **Compliance:** Significantly improved legal cover
- **Timeline:** Week 1-2 after launch (based on user feedback)

### **Phase 3: Month 6+** — Government ID Verification
- For high-risk scenarios (disputes, abuse reports)
- Users voluntarily submit government ID
- Optional (not required for signup)
- **Compliance:** Highest assurance for age-of-consent issues
- **Timeline:** Q2 2027 (post-launch learning)

---

## Current Implementation

### Launch Status: ✅ **READY**

**File Structure:**
```
lib/auth/age-verification.ts          # Verification service (supports all 3 methods)
components/auth/age-gate.tsx          # Self-declared UI component
app/api/auth/age-verify/route.ts      # POST endpoint for verification
lib/db/migrations/028_age_verification.sql  # Database schema
```

### Database Fields
```sql
users.age_verified               -- boolean (verified?)
users.age_verified_at            -- timestamp (when verified)
users.age_verification_method    -- text ('self-declared', 'yoti', 'government-id')

audit_log                        -- Immutable record of verification
├── user_id
├── action ('age_verification')
├── details (JSON with method, timestamp)
└── created_at
```

---

## How to Upgrade to Yoti (Month 1)

### 1. Download Yoti SDK
Visit https://www.yoti.com/developers/ and:
- Create Yoti account
- Download Node.js SDK
- Get `YOTI_CLIENT_SDK_ID` and download private key PEM file

### 2. Install SDK
```bash
# Yoti SDK is not on npm; manual installation required
# Place the SDK tarball in project and extract
npm install ./path-to-yoti-sdk.tgz

# Add to .env.local
YOTI_CLIENT_SDK_ID=your_sdk_id
YOTI_PEM_PATH=lib/auth/yoti.pem  # Store private key securely
AGE_PROVIDER=yoti  # Switch from 'self-declared'
```

### 3. Implement Yoti Verification
In `lib/auth/age-verification.ts`, complete the `verifyYoti()` method:

```typescript
private async verifyYoti(userId: string, data: Record<string, unknown>): Promise<AgeVerificationResult> {
  const yotiClient = new YotiClient({
    clientSdkId: process.env.YOTI_CLIENT_SDK_ID,
    pem: fs.readFileSync(process.env.YOTI_PEM_PATH, 'utf8'),
  });

  const sessionId = data.sessionId as string;
  const result = await yotiClient.getActivityDetails(sessionId);

  const ageVerified = result.profile?.ageVerified?.value === true;
  const livenessCheckPassed = result.livenessCheckPassed?.value === true;

  await this.recordVerification(userId, 'yoti', ageVerified);

  return {
    verified: ageVerified,
    method: 'yoti',
    ageConfirmed: ageVerified,
    livenessCheckPassed,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  };
}
```

### 4. Update UI
Create `components/auth/yoti-gate.tsx` with Yoti SDK client-side:
```typescript
// Yoti SDK will be loaded from https://sdk.yoti.com/...
// Initialize YotiClient and capture session ID
```

### 5. Feature Flag (Optional)
```typescript
// Allow both methods during transition
const AGE_PROVIDER = process.env.AGE_PROVIDER || 'self-declared';

// Self-declared: show checkbox
// Yoti: show "Verify with Yoti" button
// Both: let user choose
```

---

## Environment Variables

### Launch (MVP)
```bash
AGE_PROVIDER=self-declared
```

### Month 1+ (Yoti)
```bash
AGE_PROVIDER=yoti
YOTI_CLIENT_SDK_ID=your_sdk_id
YOTI_PEM_PATH=lib/auth/yoti.pem
```

### Month 6+ (Add Government ID)
```bash
AGE_PROVIDER=government-id
# Plus government ID provider credentials (IDology, Jumio, etc.)
```

---

## Compliance Notes

### COPPA (Children's Online Privacy Protection Act)
- ✅ Age gate required for US users under 13
- ✅ Self-declared confirmation stored in audit log
- ✅ Yoti verification provides legal cover

### GDPR (EU Data Protection)
- ✅ Facial biometrics (Yoti) requires explicit consent
- ✅ Data retention: Delete after 1 year if verification unsuccessful
- ✅ User right to erasure applies to audit logs

### CCPA (California Consumer Privacy Act)
- ✅ Age verification data disclosed in Privacy Policy
- ✅ User can request deletion of age verification records

---

## Testing

### Local Testing
```bash
# Test self-declared flow
curl -X POST http://localhost:3000/api/auth/age-verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"confirmedAge18Plus": true}'

# Response:
# {"success": true, "message": "Age verified"}
```

### E2E Testing
See `e2e/age-verification.spec.ts` for full test suite.

---

## Migration Path

| Date | Action | User Experience |
|------|--------|-----------------|
| Now | Launch with self-declared | Simple checkbox |
| Week 1-2 | Add Yoti option | "Verify with Yoti" button appears |
| Month 1 | Make Yoti default | Self-declared remains as fallback |
| Month 3 | Optional: Add government ID | Premium users can prove identity |

---

## Support & Troubleshooting

### "Age gate is blocking all users"
- Check `users.age_verified` — should be `true` after verification
- Check `audit_log` — entries should exist for each user

### "Yoti integration not working"
- Verify `YOTI_CLIENT_SDK_ID` in .env.local
- Verify PEM file exists at `YOTI_PEM_PATH`
- Check Yoti SDK is properly installed

### "Users can bypass age gate"
- Self-declared is honor system (hence Yoti upgrade planned)
- Legal protection: recorded consent in audit log
- Yoti upgrade adds liveness verification

---

## References

- [Yoti Documentation](https://www.yoti.com/developers/documentation)
- [COPPA Compliance](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy)
- [GDPR Biometric Data](https://gdpr-info.eu/art-9-gdpr/)

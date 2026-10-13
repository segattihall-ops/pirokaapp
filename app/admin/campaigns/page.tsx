import { CampaignsEditor } from '@/components/admin/campaigns-editor';
import { emailConfigured, emailProvider } from '@/lib/email';

export const dynamic = 'force-dynamic';

export default function CampaignsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-h2 sm:text-h1">Email campaigns</h1>
        <p className="mt-1 text-[12px] text-fg-4">
          Provider: <span className={emailConfigured() ? 'text-green' : 'text-warning'}>{emailProvider()}</span>
          {!emailConfigured() && ' — messages are logged to the console until RESEND_API_KEY or EMAIL_SERVER is set.'}
        </p>
      </div>
      <CampaignsEditor />
    </div>
  );
}

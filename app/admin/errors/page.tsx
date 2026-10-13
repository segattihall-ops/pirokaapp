import { ErrorsFeed } from '@/components/admin/errors-feed';
import { errorForwardingConfigured } from '@/lib/errors/server';

export const dynamic = 'force-dynamic';

export default function ErrorsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-h2 sm:text-h1">Errors</h1>
        <p className="mt-1 text-[12px] text-fg-4">
          Server throws (via <code>withApi</code>) and browser errors, grouped by fingerprint.
          {errorForwardingConfigured() ? ' Also mirrored to Sentry.' : ' Set SENTRY_DSN to mirror them to Sentry.'}
        </p>
      </div>
      <ErrorsFeed />
    </div>
  );
}

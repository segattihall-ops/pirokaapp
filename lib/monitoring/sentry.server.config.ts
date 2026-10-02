import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV,
  enabled: !!dsn && process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
  beforeSend(event) {
    if (event.request?.url?.includes('/health')) return null;
    return event;
  },
});

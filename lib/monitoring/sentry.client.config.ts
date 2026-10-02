import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV,
  enabled: !!dsn && process.env.NODE_ENV === 'production',
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
    new Sentry.Breadcrumbs({
      console: true,
      dom: true,
      fetch: true,
      history: true,
      sentry: true,
    }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event, hint) {
    if (event.exception) {
      const error = hint.originalException;
      if (error instanceof Error) {
        if (error.message.includes('ResizeObserver')) return null;
        if (error.message.includes('NetworkError')) return null;
      }
    }
    return event;
  },
});

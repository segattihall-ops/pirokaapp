/** Absolute origin for links inside emails and webhooks. Never trailing slash. */
export function appUrl(path = ''): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    // Vercel sets the project's production domain on production builds; VERCEL_URL is the
    // per-deployment host, which can sit behind deployment protection and is wrong in emails.
    (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  return path ? `${base}${path.startsWith('/') ? '' : '/'}${path}` : base;
}

/** Absolute origin for links inside emails and webhooks. Never trailing slash. */
export function appUrl(path = ''): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  return path ? `${base}${path.startsWith('/') ? '' : '/'}${path}` : base;
}

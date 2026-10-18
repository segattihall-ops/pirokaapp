import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/app-url';

/** Public pages are indexable; everything behind the gate, the API and tokenised links are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/app',
        '/admin',
        '/onboarding',
        '/account',
        '/api',
        '/auth',
        '/safe',
        '/unsubscribe',
        '/age',
      ],
    },
    sitemap: appUrl('/sitemap.xml'),
  };
}

import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/app-url';
import { HELP_SLUGS } from '@/lib/help';

/** Only the public, account-free pages. Event pages are shared by link and stay out on purpose. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: appUrl('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: appUrl('/status'), lastModified: now, changeFrequency: 'daily', priority: 0.3 },
    ...HELP_SLUGS.map((slug) => ({
      url: appUrl(`/help/${slug}`),
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: slug === 'help' ? 0.8 : 0.6,
    })),
  ];
}

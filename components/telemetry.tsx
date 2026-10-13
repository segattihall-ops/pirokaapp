'use client';

import { useEffect } from 'react';
import { usePageviews } from '@/lib/analytics/client';
import { installClientErrorHandlers } from '@/lib/errors/client';

/** Mounted once in Providers: page views + browser error reporting. Renders nothing. */
export function Telemetry() {
  usePageviews();
  useEffect(() => {
    installClientErrorHandlers();
  }, []);
  return null;
}

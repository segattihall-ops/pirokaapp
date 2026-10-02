'use client';

import { useEffect } from 'react';

export function ZohoDeskWidget() {
  useEffect(() => {
    const portalId = process.env.NEXT_PUBLIC_ZOHO_PORTAL_ID;
    const accountName = process.env.NEXT_PUBLIC_ZOHO_ACCOUNT_NAME;

    if (!portalId || !accountName) return;

    const script = document.createElement('script');
    script.src = `https://${accountName}.zoho.com/portal/guest/sdk/v1/portalembed.js`;
    script.async = true;
    script.onload = () => {
      if (window.ZohoDesk) {
        window.ZohoDesk.renderWidget(portalId, {
          container: '#zoho-desk-widget',
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <div id="zoho-desk-widget" />;
}

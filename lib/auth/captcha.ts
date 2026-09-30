'use client';

/**
 * Cloudflare Turnstile for Supabase Auth (Authentication → Attack Protection → Captcha).
 * Inactive until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; then every email / anonymous / password
 * sign-in carries a fresh token. Invisible unless Cloudflare decides to show a challenge.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

export const captchaEnabled = () => Boolean(SITE_KEY);

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the security check'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function container(): HTMLElement {
  let el = document.getElementById('piroka-turnstile');
  if (!el) {
    el = document.createElement('div');
    el.id = 'piroka-turnstile';
    el.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60';
    document.body.appendChild(el);
  }
  return el;
}

/** Resolves with a one-time token, or undefined when CAPTCHA is not configured. */
export async function getCaptchaToken(action = 'signin'): Promise<string | undefined> {
  if (!SITE_KEY || typeof window === 'undefined') return undefined;
  await loadScript();
  const turnstile = window.turnstile!;
  const host = container();
  const slot = document.createElement('div');
  host.appendChild(slot);

  return new Promise<string>((resolve, reject) => {
    let id = '';
    const done = (fn: () => void) => {
      fn();
      setTimeout(() => {
        try {
          if (id) turnstile.remove(id);
        } catch {}
        slot.remove();
      }, 0);
    };
    id = turnstile.render(slot, {
      sitekey: SITE_KEY,
      action,
      appearance: 'interaction-only',
      execution: 'execute',
      theme: 'dark',
      callback: (token: string) => done(() => resolve(token)),
      'error-callback': () => done(() => reject(new Error('Security check failed — please try again'))),
      'expired-callback': () => done(() => reject(new Error('Security check expired — please try again'))),
      'timeout-callback': () => done(() => reject(new Error('Security check timed out — please try again'))),
    });
    turnstile.execute(id);
  });
}

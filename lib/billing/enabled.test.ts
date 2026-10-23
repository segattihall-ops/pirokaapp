import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { POST as checkout } from '@/app/api/billing/checkout/route';
import { POST as changePlan } from '@/app/api/billing/change/route';
import { POST as subscribe } from '@/app/api/billing/subscribe/route';
import { POST as paypalWebhook } from '@/app/api/webhooks/paypal/route';
import { billingOff, paypalButtonsAllowed } from '@/lib/billing/checkout-ui';
import {
  BILLING_DISABLED_DETAIL,
  BILLING_DISABLED_ERROR,
  billingEnabled,
  billingStatusDetail,
  checkoutConfigured,
} from '@/lib/billing/enabled';
import { newCheckoutClosedResponse } from '@/lib/billing/guard';
import { paypalConfigured } from '@/lib/billing/paypal';
import { billingStatus } from '@/lib/billing/server';
import { getSystemStatus } from '@/lib/status/server';

const KEYS = ['BILLING_ENABLED', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_ENV'] as const;

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const key of Object.keys(patch)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  };
  return Promise.resolve().then(fn).finally(restore);
}

const paypalKeys = {
  PAYPAL_CLIENT_ID: 'test-client-id',
  PAYPAL_CLIENT_SECRET: 'test-client-secret',
  PAYPAL_ENV: 'live',
};

describe('BILLING_ENABLED kill switch', { concurrency: 1 }, () => {
  const saved: Record<string, string | undefined> = {};
  let paypalHits: string[] = [];
  let originalFetch: typeof fetch;

  before(() => {
    for (const key of KEYS) saved[key] = process.env[key];
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (/paypal\.com/i.test(url)) {
        paypalHits.push(url);
        throw new Error(`PayPal contacted: ${url}`);
      }
      return originalFetch(input, init);
    }) as typeof fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  test('flag is off unless the value is exactly true', () => {
    for (const value of [undefined, '', 'false', '0', '1', 'TRUE', 'True', ' true', 'true ']) {
      assert.equal(
        billingEnabled({ BILLING_ENABLED: value }),
        false,
        `expected off for ${JSON.stringify(value)}`,
      );
    }
    assert.equal(billingEnabled({ BILLING_ENABLED: 'true' }), true);
  });

  test('unset flag reports billing off even when PayPal keys exist', async () => {
    await withEnv({ BILLING_ENABLED: undefined, ...paypalKeys }, async () => {
      assert.equal(billingEnabled(), false);
      assert.equal(paypalConfigured(), true);
      assert.equal(checkoutConfigured(), false);
      const detail = billingStatusDetail();
      assert.deepEqual(detail, { state: 'off', detail: BILLING_DISABLED_DETAIL });
      const status = await getSystemStatus();
      const billing = status.components.find((c) => c.key === 'billing');
      assert.equal(billing?.state, 'off');
      assert.equal(billing?.detail, BILLING_DISABLED_DETAIL);
      const screen = await billingStatus('member-1', checkoutConfigured());
      assert.equal(screen.configured, false);
      const closed = newCheckoutClosedResponse();
      assert.ok(closed);
      assert.equal(closed.status, 503);
      assert.deepEqual(await closed.json(), { error: BILLING_DISABLED_ERROR });
    });
  });

  test('BILLING_ENABLED=true keeps the previous PayPal status', async () => {
    await withEnv({ BILLING_ENABLED: 'true', ...paypalKeys }, async () => {
      assert.equal(checkoutConfigured(), true);
      assert.equal(paypalConfigured(), true);
      assert.deepEqual(billingStatusDetail(), { state: 'ok', detail: 'PayPal live' });
      const status = await getSystemStatus();
      const billing = status.components.find((c) => c.key === 'billing');
      assert.equal(billing?.state, 'ok');
      assert.equal(billing?.detail, 'PayPal live');
      assert.equal(newCheckoutClosedResponse(), null);
      const screen = await billingStatus('member-1', checkoutConfigured());
      assert.equal(screen.configured, true);
    });

    await withEnv(
      {
        BILLING_ENABLED: 'true',
        PAYPAL_CLIENT_ID: undefined,
        PAYPAL_CLIENT_SECRET: undefined,
        PAYPAL_ENV: 'sandbox',
      },
      async () => {
        assert.equal(checkoutConfigured(), false);
        assert.equal(paypalConfigured(), false);
        assert.deepEqual(billingStatusDetail(), { state: 'off', detail: 'PayPal keys missing' });
        const status = await getSystemStatus();
        const billing = status.components.find((c) => c.key === 'billing');
        assert.equal(billing?.state, 'off');
        assert.equal(billing?.detail, 'PayPal keys missing');
      },
    );
  });

  test('checkout, subscribe, and plan change return 503 without calling PayPal when the flag is unset', async () => {
    await withEnv({ BILLING_ENABLED: undefined, ...paypalKeys }, async () => {
      paypalHits = [];
      const body = JSON.stringify({ plan: 'premium', subscriptionId: 'I-SHOULD-NOT-LOOKUP' });
      const headers = { 'content-type': 'application/json' };
      for (const post of [checkout, subscribe, changePlan]) {
        const res = await post(
          new Request('http://localhost/api/billing/checkout', { method: 'POST', headers, body }),
          undefined,
        );
        assert.equal(res.status, 503);
        assert.deepEqual(await res.json(), { error: BILLING_DISABLED_ERROR });
      }
      assert.deepEqual(paypalHits, []);
    });
  });

  test('with the flag on, new-checkout routes do not use the kill-switch response and still do not call PayPal before auth', async () => {
    await withEnv({ BILLING_ENABLED: 'true', ...paypalKeys }, async () => {
      paypalHits = [];
      const req = () =>
        new Request('http://localhost/api/billing/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan: 'plus', subscriptionId: 'I-SHOULD-NOT-LOOKUP' }),
        });

      try {
        const res = await checkout(req());
        assert.notEqual(res.status, 503);
        const body = await res.json();
        assert.notEqual(body.error, BILLING_DISABLED_ERROR);
      } catch (error) {
        assert.match(String(error), /cookies|request scope|outside|Dynamic server usage/i);
      }

      for (const post of [subscribe, changePlan]) {
        const res = await post(req(), undefined);
        assert.notEqual(res.status, 503);
        const body = await res.json();
        assert.notEqual(body.error, BILLING_DISABLED_ERROR);
      }
      assert.deepEqual(paypalHits, []);
    });
  });

  test('webhooks stay on the PayPal-key gate in both flag states', async () => {
    const call = async () => {
      paypalHits = [];
      const res = await paypalWebhook(
        new Request('http://localhost/api/webhooks/paypal', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'WH-TEST', event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: {} }),
        }),
        undefined,
      );
      const body = await res.json();
      assert.notEqual(body.error, BILLING_DISABLED_ERROR);
      assert.deepEqual(paypalHits, []);
      return { status: res.status, error: body.error as string };
    };

    const off = await withEnv({ BILLING_ENABLED: undefined, ...paypalKeys }, call);
    const on = await withEnv({ BILLING_ENABLED: 'true', ...paypalKeys }, call);
    assert.deepEqual(off, on);
    assert.equal(off.error, 'Billing not configured');
  });

  test('client buttons follow the server flag, not public PayPal ids alone', () => {
    const publicReady = true;
    assert.equal(paypalButtonsAllowed(null, publicReady), false);
    assert.equal(paypalButtonsAllowed({ configured: false, billingEnabled: false }, publicReady), false);
    assert.equal(paypalButtonsAllowed({ configured: true, billingEnabled: false }, publicReady), false);
    assert.equal(paypalButtonsAllowed({ configured: true, billingEnabled: true }, false), false);
    assert.equal(paypalButtonsAllowed({ configured: false, billingEnabled: true }, publicReady), false);
    assert.equal(paypalButtonsAllowed({ configured: true, billingEnabled: true }, publicReady), true);
    assert.equal(billingOff({ billingEnabled: false }), true);
    assert.equal(billingOff({ billingEnabled: true }), false);
    assert.equal(billingOff(null), false);
  });

  test('existing-subscription routes are not wired to the kill switch', () => {
    const untouched = [
      'app/api/billing/cancel/route.ts',
      'app/api/billing/receipts/route.ts',
      'app/api/billing/receipts/[id]/route.ts',
      'app/api/webhooks/paypal/route.ts',
      'app/api/cron/lifecycle/route.ts',
    ];
    for (const file of untouched) {
      const src = readFileSync(file, 'utf8');
      assert.doesNotMatch(src, /newCheckoutClosedResponse/);
      assert.doesNotMatch(src, /from '@\/lib\/billing\/guard'/);
      assert.doesNotMatch(src, /from '@\/lib\/billing\/enabled'/);
    }

    const statusRoute = readFileSync('app/api/billing/status/route.ts', 'utf8');
    assert.match(statusRoute, /checkoutConfigured\(\)/);
    assert.match(statusRoute, /billingEnabled/);

    const plan = readFileSync('components/billing/plan-billing.tsx', 'utf8');
    assert.match(plan, /BILLING_UNAVAILABLE_COPY/);
    assert.match(plan, /!paymentsClosed && \(!s\.subscriptionId \|\| s\.comp\)/);
    assert.match(plan, /!paymentsClosed && s\.plan === 'plus'/);

    const buttons = readFileSync('components/billing/paypal-checkout.tsx', 'utf8');
    assert.match(buttons, /paypalButtonsAllowed/);
    assert.match(buttons, /BILLING_UNAVAILABLE_COPY/);
    assert.doesNotMatch(buttons, /configured !== false/);
  });
});

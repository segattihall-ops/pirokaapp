// Ops alert delivery. No network: sendEmail and fetch are fakes. Nothing is sent to Resend.
// Run: node --import ./tests/register-ts.mjs --test tests/ops-alerts.test.mjs
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatchOpsAlert } from '../lib/alerts/dispatch.ts';
import { opsAlertsConfigured, opsAlertsDetail, redactOpsAlert } from '../lib/alerts/policy.ts';

const T0 = Date.parse('2026-10-23T18:00:00.000Z');
const ORIGIN = 'https://www.pirokaapp.com';
const FIVE_MIN = 5 * 60 * 1000;

function harness(env, overrides = {}) {
  const emails = [];
  const hooks = [];
  const logs = [];
  const seen = new Map();
  let now = T0;
  const deps = {
    env,
    origin: ORIGIN,
    seen,
    now: () => now,
    timeoutMs: 500,
    info: (line) => logs.push(line),
    error: (line) => logs.push(`error:${line}`),
    fetch: async (url, init) => {
      hooks.push({ url, init });
      return new Response('ok', { status: 200 });
    },
    sendEmail: async (input) => {
      emails.push(input);
      return { ok: true };
    },
    ...overrides,
  };
  return {
    deps,
    emails,
    hooks,
    logs,
    seen,
    setNow: (t) => {
      now = t;
    },
  };
}

function hookBody(hook) {
  return JSON.parse(hook.init.body);
}

describe('channel status', () => {
  test('email only', () => {
    const env = { OPS_ALERT_EMAIL: 'ops@example.com' };
    assert.equal(opsAlertsConfigured(env), true);
    assert.equal(opsAlertsDetail(env), 'email');
  });

  test('webhook only', () => {
    const env = { OPS_WEBHOOK_URL: 'https://hooks.example/secret-token' };
    assert.equal(opsAlertsConfigured(env), true);
    assert.equal(opsAlertsDetail(env), 'webhook');
    assert.equal(opsAlertsDetail(env).includes('secret-token'), false);
  });

  test('both', () => {
    const env = { OPS_ALERT_EMAIL: 'ops@example.com', OPS_WEBHOOK_URL: 'https://hooks.example/hook' };
    assert.equal(opsAlertsConfigured(env), true);
    assert.equal(opsAlertsDetail(env), 'email + webhook');
  });

  test('neither', () => {
    assert.equal(opsAlertsConfigured({}), false);
    assert.equal(opsAlertsDetail({}), 'OPS_ALERT_EMAIL and OPS_WEBHOOK_URL missing');
    assert.equal(opsAlertsConfigured({ OPS_ALERT_EMAIL: '   ', OPS_WEBHOOK_URL: '' }), false);
  });

  test('invalid address is not a configured email channel', () => {
    const env = { OPS_ALERT_EMAIL: 'not-an-email' };
    assert.equal(opsAlertsConfigured(env), false);
    assert.equal(opsAlertsDetail(env), 'OPS_ALERT_EMAIL has no valid address');
  });
});

describe('delivery', () => {
  test('email only sends through the email channel and not the webhook', async () => {
    const h = harness({ OPS_ALERT_EMAIL: ' Ops@Example.com, ops@example.com , bad ' });
    const result = await dispatchOpsAlert('payment', 'Payment failed for subscription I-ABC · count 1', h.deps);
    assert.equal(result.ok, true);
    assert.equal(result.deduped, false);
    assert.equal(result.emailed, 1);
    assert.equal(result.webhook, 'skipped');
    assert.equal(h.hooks.length, 0);
    assert.equal(h.emails.length, 1);
    assert.equal(h.emails[0].to, 'ops@example.com');
    assert.equal(h.emails[0].subject, '[PIROKA alert] payment');
    assert.match(h.emails[0].text, /\[πroka payment\] Payment failed for subscription I-ABC/);
    assert.match(h.emails[0].text, /https:\/\/www\.pirokaapp\.com\/admin\/revenue/);
    assert.match(h.emails[0].text, /2026-10-23T18:00:00\.000Z/);
    assert.equal(h.emails[0].html.replace(/<[^>]+>/g, ''), h.emails[0].text);
    assert.match(h.emails[0].html, /Payment failed for subscription I-ABC/);
  });

  test('webhook only posts the same one-line body', async () => {
    const h = harness({ OPS_WEBHOOK_URL: ' https://hooks.example/hook ' });
    const result = await dispatchOpsAlert('report', 'New harassment report rep-1', h.deps);
    assert.equal(result.ok, true);
    assert.equal(result.emailed, 0);
    assert.equal(result.webhook, 'sent');
    assert.equal(h.emails.length, 0);
    assert.equal(h.hooks.length, 1);
    assert.equal(h.hooks[0].url, 'https://hooks.example/hook');
    assert.equal(h.hooks[0].init.method, 'POST');
    const body = hookBody(h.hooks[0]);
    assert.equal(body.text, body.content);
    assert.match(body.text, /\[πroka report\] New harassment report rep-1/);
    assert.match(body.text, /\/admin\/reports/);
    assert.equal(body.text.includes('secret'), false);
  });

  test('both channels get the same line', async () => {
    const h = harness({
      OPS_ALERT_EMAIL: 'a@example.com, b@example.com',
      OPS_WEBHOOK_URL: 'https://hooks.example/hook',
    });
    const result = await dispatchOpsAlert('feedback', 'bug fb-9 · /admin/feedback', h.deps);
    assert.equal(result.ok, true);
    assert.equal(result.emailed, 2);
    assert.equal(result.webhook, 'sent');
    assert.deepEqual(
      h.emails.map((e) => e.to),
      ['a@example.com', 'b@example.com'],
    );
    const body = hookBody(h.hooks[0]);
    assert.equal(h.emails[0].text, h.emails[1].text);
    assert.equal(h.emails[0].text, body.text);
    assert.equal(h.emails[0].subject, '[PIROKA alert] feedback');
    assert.equal(h.emails[0].html.includes('<script>'), false);
  });

  test('neither channel logs and does not send', async () => {
    const h = harness({});
    const result = await dispatchOpsAlert('ops', 'lat: 40.758901 ping', h.deps);
    assert.equal(result.ok, false);
    assert.equal(result.emailed, 0);
    assert.equal(result.webhook, 'skipped');
    assert.equal(h.emails.length, 0);
    assert.equal(h.hooks.length, 0);
    assert.equal(h.logs.length, 1);
    assert.match(h.logs[0], /^\[ops-alert:console\] /);
    assert.equal(h.logs[0].includes('40.758901'), false);
  });

  test('escapes html in the email body', async () => {
    const h = harness({ OPS_ALERT_EMAIL: 'ops@example.com' });
    await dispatchOpsAlert('ops', 'note <script>alert(1)</script>', h.deps);
    assert.match(h.emails[0].html, /&lt;script&gt;/);
    assert.equal(h.emails[0].html.includes('<script>'), false);
  });
});

describe('redaction', () => {
  test('strips coordinates, chat, identity documents and narratives', () => {
    const id = '3f2a1c4e-1111-4111-8111-111111111111';
    const line = redactOpsAlert(
      `report ${id} count 2 · https://www.pirokaapp.com/admin/reports · lat: 40.758901 · pin 40.758901, -73.985102 · geo:40.710000,-74.000000 · passport XY1234567 · ssn 123-45-6789 · chat: meet me behind the blue door · updates person@example.com`,
    );
    assert.equal(line.includes('40.758901'), false);
    assert.equal(line.includes('-73.985102'), false);
    assert.equal(line.includes('40.710000'), false);
    assert.equal(line.includes('meet me behind'), false);
    assert.equal(line.includes('XY1234567'), false);
    assert.equal(line.includes('123-45-6789'), false);
    assert.equal(line.includes('person@example.com'), false);
    assert.match(line, new RegExp(id));
    assert.match(line, /\/admin\/reports/);
    assert.match(line, /count 2/);
    assert.match(line, /\[coords\]/);
    assert.match(line, /\[chat\]/);
    assert.match(line, /\[id-doc\]/);
  });

  test('drops a full report narrative and query-string coordinates', () => {
    const line = redactOpsAlert(
      'public report TS-40001 · Harassment · /admin/reports?lat=40.758901&lng=-73.985102\nThey followed me from the station and this is the full story of what happened in private, which must not be copied into an inbox.',
    );
    assert.equal(line.includes('followed me from the station'), false);
    assert.equal(line.includes('40.758901'), false);
    assert.match(line, /TS-40001/);
    assert.match(line, /\/admin\/reports/);
    assert.match(line, /\[narrative withheld\]/);
  });

  test('labeled narrative and a document image do not survive', () => {
    const line = redactOpsAlert(
      'report TS-9 · details: ' +
        'a'.repeat(90) +
        ' · data:image/jpeg;base64,abcdEFGHijkl ' +
        " · driver's license D12345678",
    );
    assert.equal(line.includes('aaaa'), false);
    assert.equal(line.includes('abcdEFGH'), false);
    assert.equal(line.includes('D12345678'), false);
    assert.match(line, /TS-9/);
  });

  test('the email and the webhook both receive the redacted line', async () => {
    const h = harness({
      OPS_ALERT_EMAIL: 'ops@example.com',
      OPS_WEBHOOK_URL: 'https://hooks.example/secret-token-abc',
    });
    const dirty =
      'report rep-7 count 4 · /admin/reports · 40.758901, -73.985102 · chat: the private thread said to bring the letter · passport AB9988771\n' +
      'Full report narrative that names the street, repeats the conversation, and must stay in the admin queue only.';
    await dispatchOpsAlert('report', dirty, h.deps);
    const text = h.emails[0].text;
    assert.equal(text, hookBody(h.hooks[0]).text);
    for (const secret of ['40.758901', '-73.985102', 'private thread', 'AB9988771', 'names the street', 'secret-token-abc']) {
      assert.equal(text.includes(secret), false, secret);
      assert.equal(h.emails[0].html.includes(secret), false, secret);
    }
    assert.match(text, /rep-7/);
    assert.match(text, /count 4/);
    assert.match(text, /\/admin\/reports/);
    assert.match(text, /2026-10-23T18:00:00\.000Z/);
    assert.equal(h.emails[0].subject, '[PIROKA alert] report');
  });
});

describe('dedupe', () => {
  test('the same key is sent once inside five minutes and again after the window', async () => {
    const h = harness({ OPS_ALERT_EMAIL: 'ops@example.com', OPS_WEBHOOK_URL: 'https://hooks.example/hook' });
    const message = 'Error spike in /api/map · fp-1 · count 10';
    const first = await dispatchOpsAlert('error', message, h.deps);
    h.setNow(T0 + FIVE_MIN - 1);
    const second = await dispatchOpsAlert('error', message, h.deps);
    assert.equal(first.deduped, false);
    assert.equal(second.deduped, true);
    assert.equal(second.emailed, 0);
    assert.equal(h.emails.length, 1);
    assert.equal(h.hooks.length, 1);

    h.setNow(T0 + FIVE_MIN);
    const third = await dispatchOpsAlert('error', message, h.deps);
    assert.equal(third.deduped, false);
    assert.equal(h.emails.length, 2);
    assert.equal(h.hooks.length, 2);
  });

  test('coordinates that redact to the same line share one key, different ids do not', async () => {
    const h = harness({ OPS_ALERT_EMAIL: 'ops@example.com' });
    await dispatchOpsAlert('report', 'report abc · 40.111111, -73.222222', h.deps);
    await dispatchOpsAlert('report', 'report abc · 41.333333, -74.444444', h.deps);
    await dispatchOpsAlert('report', 'report other-id · 41.333333, -74.444444', h.deps);
    assert.equal(h.emails.length, 2);
    assert.equal(h.emails[0].text.includes('40.111111'), false);
    assert.equal(h.emails[1].text.includes('other-id'), true);
  });

  test('a failed send does not burn the dedupe window', async () => {
    let calls = 0;
    const h = harness(
      { OPS_ALERT_EMAIL: 'ops@example.com' },
      {
        sendEmail: async () => {
          calls += 1;
          return { ok: false };
        },
      },
    );
    const first = await dispatchOpsAlert('ops', 'digest delayed count 1', h.deps);
    const second = await dispatchOpsAlert('ops', 'digest delayed count 1', h.deps);
    assert.equal(first.ok, false);
    assert.equal(first.deduped, false);
    assert.equal(second.deduped, false);
    assert.equal(calls, 2);
  });
});

describe('email failure does not reject', () => {
  test('a throwing sender still delivers the webhook and resolves', async () => {
    const h = harness(
      { OPS_ALERT_EMAIL: 'ops@example.com', OPS_WEBHOOK_URL: 'https://hooks.example/hook' },
      {
        sendEmail: async () => {
          throw new Error('Resend 500: no');
        },
      },
    );
    const result = await dispatchOpsAlert('payment', 'Payment failed for subscription I-1', h.deps);
    assert.equal(result.ok, true);
    assert.equal(result.emailed, 0);
    assert.equal(result.webhook, 'sent');
    assert.equal(h.hooks.length, 1);
    assert.match(h.logs.join('\n'), /ops alert email failed/);
  });

  test('a throwing webhook still delivers email and resolves', async () => {
    const h = harness(
      { OPS_ALERT_EMAIL: 'ops@example.com', OPS_WEBHOOK_URL: 'https://hooks.example/hook' },
      {
        fetch: async () => {
          throw new Error('socket hang up at https://hooks.example/hook');
        },
      },
    );
    const result = await dispatchOpsAlert('payment', 'Payment failed for subscription I-2', h.deps);
    assert.equal(result.ok, true);
    assert.equal(result.emailed, 1);
    assert.equal(result.webhook, 'failed');
    assert.equal(h.emails[0].text.includes('hooks.example'), false);
  });

  test('a hung sender resolves on the timeout', async () => {
    let calls = 0;
    const h = harness(
      { OPS_ALERT_EMAIL: 'ops@example.com' },
      {
        timeoutMs: 30,
        sendEmail: () => {
          calls += 1;
          return new Promise(() => {});
        },
      },
    );
    const started = Date.now();
    const result = await dispatchOpsAlert('error', 'Error spike in /api/x · fp · count 10', h.deps);
    assert.equal(result.ok, false);
    assert.ok(Date.now() - started < 1000);
    const again = await dispatchOpsAlert('error', 'Error spike in /api/x · fp · count 10', h.deps);
    assert.equal(again.deduped, false);
    assert.equal(calls, 2);
  });
});

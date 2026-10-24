import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { CONTACT_EMAIL } from '@/lib/contact';
import { HELP_CONTENT } from '@/lib/help-content';

const terms = HELP_CONTENT.terms;
const termsText = [terms.meta, ...terms.sections.flatMap((section) => [section.heading, section.body])].join(
  '\n',
);
const custodian = HELP_CONTENT['2257'].sections.find((section) => section.heading === 'Custodian of records');

describe('Terms of Service', () => {
  test('shows a last-updated date and a DMCA section, and does not name piroka.app', () => {
    assert.equal(terms.meta, 'Last updated October 24, 2026');
    assert.ok(terms.sections.some((section) => section.heading === 'Copyright and DMCA'));
    assert.match(termsText, /DMCA/);
    assert.equal(termsText.toLowerCase().includes('piroka.app'), false);
    assert.ok(termsText.includes(CONTACT_EMAIL.dmca));
    assert.equal(CONTACT_EMAIL.dmca, 'dmca@pirokaapp.com');
  });

  test('covers the launch clauses and the counsel placeholders', () => {
    assert.match(termsText, /\[GOVERNING STATE - COUNSEL TO CONFIRM\]/);
    assert.match(termsText, /\[COMPANY LEGAL NAME AND ADDRESS - COUNSEL TO CONFIRM\]/);
    for (const phrase of [
      'at least 18',
      'Minors are prohibited',
      'informal resolution',
      'individual arbitration',
      'class-action waiver',
      'small-claims carve-out',
      'opt-out window',
      'Disclaimer of warranties',
      'Limitation of liability',
      'Indemnification',
      'Termination',
      'Changes to these terms',
      'harass',
      'stalk',
      'coerc',
      'sextortion',
      'NCII',
      'CSAM',
      'fraud',
      'prostitution',
      'counter-notice',
      'repeat infringers',
    ]) {
      assert.match(termsText, new RegExp(phrase));
    }
  });
});

describe('2257 custodian', () => {
  test('keeps the compliance mailbox and marks the missing address for counsel', () => {
    assert.ok(custodian);
    assert.match(custodian.body, /\[COMPANY LEGAL NAME AND ADDRESS - COUNSEL TO CONFIRM\]/);
    assert.ok(custodian.body.includes(CONTACT_EMAIL.compliance));
    assert.equal(custodian.body.toLowerCase().includes('piroka.app'), false);
    assert.equal(
      /\d{1,5}\s+\w+\s+(Street|St|Drive|Dr|Avenue|Ave|Road|Rd|Boulevard|Blvd)/i.test(custodian.body),
      false,
    );
  });
});

describe('search_path migration', () => {
  test('pins the production signatures and swallows a failed st_estimatedextent revoke', () => {
    const sql = readFileSync('supabase/migrations/20261024190000_053_pin_function_search_path.sql', 'utf8');
    assert.match(
      sql,
      /alter function public\.nearby_area_messages\(p_lat double precision, p_lon double precision, p_radius_m integer\) set search_path = public, pg_temp/,
    );
    assert.match(
      sql,
      /alter function public\.campaign_segment_sql\(p_segment text\) set search_path = public, pg_temp/,
    );
    assert.match(
      sql,
      /grant execute on function public\.nearby_area_messages\(p_lat double precision, p_lon double precision, p_radius_m integer\) to service_role/,
    );
    assert.match(
      sql,
      /grant execute on function public\.campaign_segment_sql\(p_segment text\) to service_role/,
    );
    assert.match(sql, /public\.st_estimatedextent\(text, text\)/);
    assert.match(sql, /public\.st_estimatedextent\(text, text, text\)/);
    assert.match(sql, /public\.st_estimatedextent\(text, text, text, boolean\)/);
    assert.match(sql, /revoke execute on function %s from public, anon, authenticated/);
    assert.match(sql, /when insufficient_privilege then/);
    assert.match(sql, /raise notice 'skipped revoke on %: insufficient_privilege: %'/);
    assert.equal(sql.toLowerCase().includes('piroka.app'), false);
    assert.doesNotMatch(sql, /create or replace function public\.nearby_area_messages/i);
  });
});

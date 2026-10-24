import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const sql = readFileSync('supabase/migrations/20261024210000_054_nearby_area_messages_metres.sql', 'utf8');

function executableSql(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

const body = executableSql(sql);

describe('nearby_area_messages metre migration', () => {
  test('replaces the production signature in metres and does not return coordinates', () => {
    assert.match(body, /create or replace function public\.nearby_area_messages/i);
    assert.match(body, /p_lat double precision,\s*p_lon double precision,\s*p_radius_m integer/i);
    assert.match(body, /distance_m integer/i);
    assert.match(body, /am\.parent_id is null/i);
    assert.match(body, /<= p_radius_m\b/);
    assert.match(body, /set search_path = public, pg_temp/i);
    assert.match(body, /limit 200/i);
    assert.doesNotMatch(body, /\/\s*1000/);
    assert.doesNotMatch(body, /p_radius_m\s*\*\s*1000/);

    const returns = body.match(/returns table \([\s\S]*?\)/i)?.[0] ?? '';
    assert.match(returns, /id bigint/i);
    assert.match(returns, /author_id uuid/i);
    assert.match(returns, /content text/i);
    assert.match(returns, /created_at timestamp with time zone/i);
    assert.match(returns, /distance_m integer/i);
    assert.doesNotMatch(returns, /\blat\b/i);
    assert.doesNotMatch(returns, /\blon\b/i);
  });

  test('restates the production execute grants and skips when parent_id is absent', () => {
    assert.match(
      body,
      /revoke all on function public\.nearby_area_messages\(p_lat double precision, p_lon double precision, p_radius_m integer\) from public, anon, authenticated/i,
    );
    assert.match(
      body,
      /grant execute on function public\.nearby_area_messages\(p_lat double precision, p_lon double precision, p_radius_m integer\) to postgres/i,
    );
    assert.match(
      body,
      /grant execute on function public\.nearby_area_messages\(p_lat double precision, p_lon double precision, p_radius_m integer\) to service_role/i,
    );
    assert.match(body, /area_messages\.parent_id is not present/);
    assert.doesNotMatch(body, /grant execute[\s\S]*to (anon|authenticated)/i);
    assert.equal(sql.toLowerCase().includes('piroka.app'), false);
  });
});

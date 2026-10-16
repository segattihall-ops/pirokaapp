/**
 * Tells a "the database is behind the code" failure apart from everything else.
 *
 * A route that reads or writes a column, table or enum value added by a migration that has not
 * been applied in production gets one of these from PostgREST / Postgres. The caller can then
 * answer 503 with a clear message (and degrade where possible) instead of a generic 500 that
 * looks like a bug in the request. Seen in production on 2026-10-07 (PGRST205, `travel_mode`)
 * and predicted for 2026-10-16 (`statuses.travel_mi`, `desperate_alerts`, intent `couchless`).
 */
type PgError = { code?: string | null; message?: string | null } | null | undefined;

const CODES = new Set([
  'PGRST204', // column not found in the PostgREST schema cache
  'PGRST205', // table not found in the PostgREST schema cache
  '42703', // undefined column
  '42P01', // undefined table
]);

export function isMissingSchema(error: PgError): boolean {
  if (!error) return false;
  if (error.code && CODES.has(error.code)) return true;
  // 22P02 covers every bad literal; only the enum variant means "value added by a later migration".
  return error.code === '22P02' && /invalid input value for enum/i.test(error.message ?? '');
}

export const SCHEMA_PENDING_MESSAGE =
  'This feature needs a database update that has not been applied yet. Please try again later.';

export function schemaPendingResponse(migration: string) {
  return {
    error: SCHEMA_PENDING_MESSAGE,
    code: 'schema_pending',
    migration,
  };
}

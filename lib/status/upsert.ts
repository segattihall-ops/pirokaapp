import { isMissingSchema } from '@/lib/db/schema-errors';
import type { Intent } from '@/lib/intent';

/**
 * The row POST /api/me/status writes. `travel_mi` is always present: a number for the "travel"
 * intent, `null` for every other one, so switching away from "travel" clears the old radius
 * instead of leaving it behind in the upsert (Codex P2 on PR 24).
 */
export type StatusUpsertRow = {
  user_id: string;
  intent: Intent;
  starts_at: string;
  ends_at: string;
  warned: boolean;
  travel_mi: number | null;
};

export type UpsertError = { code?: string | null; message?: string | null } | null;

/** The one database call the helper needs: upsert a row, report the PostgREST error if any. */
export type UpsertFn = (row: Record<string, unknown>) => Promise<{ error: UpsertError }>;

export type UpsertStatusResult = {
  error: UpsertError;
  /** True when the row was written without `travel_mi` because migration 035 is not applied yet. */
  legacy: boolean;
};

/**
 * Writes the status row, always including `travel_mi` first so a non-travel intent nulls out a
 * previous radius. When the database answers with a "schema is behind the code" error and the
 * row carries no radius, the write is retried without the column (pre 035 compatibility). A row
 * that does carry a radius is never retried: dropping the radius silently would be worse than the
 * 503 schema_pending the route answers with.
 */
export async function upsertStatusWithTravelFallback(
  upsert: UpsertFn,
  row: StatusUpsertRow,
): Promise<UpsertStatusResult> {
  const first = await upsert(row);
  if (!first.error) return { error: null, legacy: false };
  if (!isMissingSchema(first.error) || row.travel_mi !== null) return { error: first.error, legacy: false };
  const { travel_mi: _omitted, ...withoutTravel } = row;
  void _omitted;
  const second = await upsert(withoutTravel);
  return { error: second.error, legacy: true };
}

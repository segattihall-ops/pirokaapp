/**
 * After a deploy the browser may still hold a hashed chunk URL that no longer exists, so a lazy
 * import throws ChunkLoadError ("Loading chunk 4420 failed"). A fresh load fixes it; `reset()` does
 * not, because it re-runs the same stale bundle. We reload once and never loop: a module flag stops
 * a second reload in this page load, and a sessionStorage timestamp stops a reload storm across the
 * reload itself (a genuinely broken chunk would otherwise reload forever).
 */
export function isChunkLoadError(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const name = error.name ?? '';
  const msg = error.message ?? '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed|Loading CSS chunk [\w-]+ failed|error loading dynamically imported module|Importing a module script failed/i.test(
      msg,
    )
  );
}

let reloadedThisLoad = false;
const RELOAD_KEY = 'piroka:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 15_000;

/** Reloads once when the error is a stale-chunk error. Returns true if a reload was triggered. */
export function maybeRecoverFromChunkError(error: { name?: string; message?: string } | null | undefined): boolean {
  if (typeof window === 'undefined' || reloadedThisLoad || !isChunkLoadError(error)) return false;

  let recentlyReloaded = false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || '0');
    recentlyReloaded = Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage blocked (private mode, blocked cookies): the module flag below still prevents a loop within this load.
  }
  if (recentlyReloaded) return false;

  reloadedThisLoad = true;
  window.location.reload();
  return true;
}

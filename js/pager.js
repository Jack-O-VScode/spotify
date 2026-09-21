// ---------------------------------------------------------------------------
// Wraps Spotify's paging object (used identically by playlist items, saved
// tracks, and recently-played — all three return { items, next }) into a
// simple "load the next page" helper for infinite-scroll-by-button lists.
// ---------------------------------------------------------------------------

import { apiFetch, API_BASE, ApiError } from "./api.js";

// `fallbackPath` covers Spotify's Feb/March 2026 rename of
// /playlists/{id}/tracks to /playlists/{id}/items. The rollout has not been
// uniform across apps and accounts, and the losing variant answers 403/404
// rather than anything self-describing, so rather than betting on one name
// this tries the other once before giving up.
export function createPager(initialPath, { fallbackPath = null } = {}) {
  let nextPath = initialPath;
  let fallback = fallbackPath;
  let exhausted = false;

  async function fetchPage() {
    try {
      return await apiFetch(nextPath);
    } catch (err) {
      const worthRetrying = err instanceof ApiError && (err.status === 403 || err.status === 404);
      if (!fallback || !worthRetrying) throw err;
      nextPath = fallback;
      fallback = null;
      return apiFetch(nextPath);
    }
  }

  return {
    get hasMore() {
      return !exhausted;
    },
    async loadNext() {
      if (exhausted) return [];
      const data = await fetchPage();
      nextPath = data?.next ? data.next.slice(API_BASE.length) : null;
      exhausted = !nextPath;
      return data?.items || [];
    },
  };
}

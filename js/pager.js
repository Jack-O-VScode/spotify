// ---------------------------------------------------------------------------
// Wraps Spotify's paging object (used identically by playlist tracks, saved
// tracks, and recently-played — all three return { items, next }) into a
// simple "load the next page" helper for infinite-scroll-by-button lists.
// ---------------------------------------------------------------------------

import { apiFetch, API_BASE } from "./api.js";

export function createPager(initialPath) {
  let nextPath = initialPath;
  let exhausted = false;

  return {
    get hasMore() {
      return !exhausted;
    },
    async loadNext() {
      if (exhausted) return [];
      const data = await apiFetch(nextPath);
      nextPath = data?.next ? data.next.slice(API_BASE.length) : null;
      exhausted = !nextPath;
      return data?.items || [];
    },
  };
}

// ---------------------------------------------------------------------------
// "/recent" route: Recently Played. Same shape/limitation as Liked Songs —
// no context_uri, so playback passes the loaded URIs directly.
// ---------------------------------------------------------------------------

import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { mountTrackPage } from "../components/track-page.js";

export function render(container) {
  clear(container);
  container.appendChild(
    el("div", { class: "page page-simple-list" }, [
      el("button", { class: "back-button", type: "button", onclick: () => navigate("#/library"), text: "‹ Library" }),
      el("h1", { class: "detail-header-title detail-header-title-plain", text: "Recently Played" }),
    ])
  );

  const page = container.querySelector(".page-simple-list");
  const listEl = el("div", { class: "track-list" });
  const loadMoreButton = el("button", { class: "btn-secondary load-more-button hidden", type: "button", text: "Load more" });
  page.appendChild(listEl);
  page.appendChild(loadMoreButton);

  // Spotify's recently-played is a play *log*, so a track played three
  // times in a row appears three times. Collapse repeats to the most recent
  // entry — mountTrackPage already skips items that map to nothing.
  const seen = new Set();

  return mountTrackPage({
    listEl,
    loadMoreButton,
    pagerPath: "/me/player/recently-played?limit=50",
    mapItem: (rawItem) => {
      const track = rawItem.track;
      if (!track || seen.has(track.uri)) return null;
      seen.add(track.uri);
      return track;
    },
    getPlayArgs: (absoluteIndex, loadedUris) => ({ uris: loadedUris, offset: { position: absoluteIndex } }),
    emptyMessage: "Nothing played recently.",
  });
}

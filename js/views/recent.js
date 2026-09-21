// ---------------------------------------------------------------------------
// "/recent" route: Recently Played. Same shape/limitation as Liked Songs —
// no context_uri, so playback passes the loaded URIs directly.
// ---------------------------------------------------------------------------

import { el } from "../dom.js";
import { navigate } from "../router.js";
import { mountTrackPage } from "../components/track-page.js";

export function render(container) {
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

  return mountTrackPage({
    listEl,
    loadMoreButton,
    pagerPath: "/me/player/recently-played?limit=50",
    getPlayArgs: (absoluteIndex, loadedUris) => ({ uris: loadedUris, offset: { position: absoluteIndex } }),
    emptyMessage: "Nothing played recently.",
  });
}

// ---------------------------------------------------------------------------
// "/liked" route: Liked Songs. There's no addressable context_uri for a
// user's saved tracks, so playing one passes the loaded URIs directly with
// an offset instead of a playlist context.
// ---------------------------------------------------------------------------

import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { mountTrackPage } from "../components/track-page.js";

export function render(container) {
  clear(container);
  container.appendChild(
    el("div", { class: "page page-simple-list" }, [
      el("button", { class: "back-button", type: "button", onclick: () => navigate("#/library"), text: "‹ Library" }),
      el("h1", { class: "detail-header-title detail-header-title-plain", text: "Liked Songs" }),
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
    pagerPath: "/me/tracks?limit=50",
    getPlayArgs: (absoluteIndex, loadedUris) => ({ uris: loadedUris, offset: { position: absoluteIndex } }),
    emptyMessage: "No liked songs yet.",
  });
}

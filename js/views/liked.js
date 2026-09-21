// ---------------------------------------------------------------------------
// "/liked" route: Liked Songs. There's no addressable context_uri for a
// user's saved tracks, so playing passes the loaded URIs directly with an
// offset instead of a playlist context — which also means Play/Shuffle here
// cover the tracks loaded so far rather than the whole library.
// ---------------------------------------------------------------------------

import { el, clear } from "../dom.js";
import { navigate } from "../router.js";
import { mountTrackPage } from "../components/track-page.js";
import { play, setShuffle } from "../player.js";
import { showToast } from "../toast.js";
import { icon } from "../icons.js";

export function render(container) {
  clear(container);

  const page = el("div", { class: "page page-simple-list" }, [
    el("button", { class: "back-button", type: "button", onclick: () => navigate("#/library"), text: "‹ Library" }),
    el("h1", { class: "detail-header-title detail-header-title-plain", text: "Liked Songs" }),
  ]);
  container.appendChild(page);

  const controls = {};
  page.appendChild(buildActions(controls));

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
    controls,
  });
}

function buildActions(controls) {
  async function start(shuffled) {
    const uris = controls.getLoadedUris ? controls.getLoadedUris() : [];
    if (uris.length === 0) {
      showToast("Nothing loaded to play yet.");
      return;
    }
    await setShuffle(shuffled);
    play({ uris, offset: { position: 0 } });
  }

  return el("div", { class: "playlist-actions" }, [
    el(
      "button",
      { class: "playlist-action playlist-action-primary", type: "button", onclick: () => start(false) },
      [icon("play", { size: 18 }), el("span", { text: "Play" })]
    ),
    el("button", { class: "playlist-action", type: "button", onclick: () => start(true) }, [
      icon("shuffle", { size: 18 }),
      el("span", { text: "Shuffle" }),
    ]),
  ]);
}

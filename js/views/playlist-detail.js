// ---------------------------------------------------------------------------
// "/playlist/:id" route: playlist header (art, name, owner, track count)
// plus its tracks, tap-to-play. Playing a track uses the playlist as
// context_uri + offset so playback continues into the rest of the playlist,
// same as tapping a track in the real Spotify app.
// ---------------------------------------------------------------------------

import { apiFetch } from "../api.js";
import { el, clear } from "../dom.js";
import { pickImage } from "../format.js";
import { navigate } from "../router.js";
import { renderLoading, renderError } from "../components/async-states.js";
import { mountTrackPage } from "../components/track-page.js";

// Deliberately no `fields=` filter. Spotify's Feb/March 2026 migration
// renamed the playlist track-count field (tracks.total -> items.total) on
// Development Mode apps, and a `fields` filter naming the wrong one just
// silently omits it — which is exactly how this ended up rendering
// "0 tracks". Fetching the whole object and reading whichever field is
// actually present is a few KB more and one less thing to get wrong.

export function render(container, params) {
  const playlistId = params.id;
  // Shared mutable box: the real cleanup function is only known once the
  // async mount below finishes, but router.js needs *something* synchronous
  // back from render() to call later. It reads disposeBag.current at
  // teardown time, by which point the async work has filled it in.
  const disposeBag = { current: null };
  load(container, playlistId, disposeBag);
  return () => disposeBag.current?.();
}

async function load(container, playlistId, disposeBag) {
  renderLoading(container, "Loading playlist…");
  try {
    const playlist = await apiFetch(`/playlists/${encodeURIComponent(playlistId)}`);
    // The user may have navigated elsewhere while this was in flight.
    if (window.location.hash !== `#/playlist/${playlistId}`) return;
    renderShell(container, playlist, disposeBag);
  } catch (err) {
    if (window.location.hash !== `#/playlist/${playlistId}`) return;
    renderError(container, err, () => load(container, playlistId, disposeBag));
  }
}

function renderShell(container, playlist, disposeBag) {
  clear(container);

  const contextUri = `spotify:playlist:${playlist.id}`;
  const art = pickImage(playlist.images, 400);

  const page = el("div", { class: "page page-playlist-detail" });

  page.appendChild(
    el("button", { class: "back-button", type: "button", onclick: () => navigate("#/library"), text: "‹ Library" })
  );

  page.appendChild(
    el("div", { class: "detail-header" }, [
      art
        ? el("img", { class: "detail-header-art", src: art, alt: "" })
        : el("div", { class: "detail-header-art detail-header-art-placeholder" }),
      el("h1", { class: "detail-header-title", text: playlist.name || "Untitled playlist" }),
      el("p", {
        class: "detail-header-subtitle",
        text: `${playlist.owner?.display_name || "Unknown"} · ${playlist.tracks?.total ?? playlist.items?.total ?? 0} tracks`,
      }),
    ])
  );

  const listEl = el("div", { class: "track-list" });
  page.appendChild(listEl);

  const loadMoreButton = el("button", { class: "btn-secondary load-more-button hidden", type: "button", text: "Load more" });
  page.appendChild(loadMoreButton);

  container.appendChild(page);

  disposeBag.current = mountTrackPage({
    listEl,
    loadMoreButton,
    // Renamed from /tracks to /items in Spotify's Feb/March 2026 migration —
    // the old path now 403s on new Development Mode apps.
    pagerPath: `/playlists/${encodeURIComponent(playlist.id)}/items?limit=50`,
    // The per-entry key was renamed alongside the endpoint (track -> item);
    // falling back to .track keeps this working if that's ever not so.
    mapItem: (rawItem) => rawItem.item || rawItem.track,
    getPlayArgs: (absoluteIndex) => ({ contextUri, offset: { position: absoluteIndex } }),
    emptyMessage: "This playlist is empty.",
  });
}

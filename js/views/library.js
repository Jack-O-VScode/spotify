// ---------------------------------------------------------------------------
// Default "/library" route: shortcuts into Liked Songs / Recently Played,
// then a grid of the user's playlists — modeled on the Spotify app's
// Library tab.
// ---------------------------------------------------------------------------

import { apiFetch } from "../api.js";
import { el, clear } from "../dom.js";
import { pickImage } from "../format.js";
import { navigate } from "../router.js";
import { renderLoading, renderError } from "../components/async-states.js";
import { icon } from "../icons.js";
import { store } from "../state.js";
import { open as openDeviceSheet } from "../components/device-sheet.js";

export function render(container) {
  // The hint below subscribes to playback state, and the real teardown is
  // only known once the async load finishes — so router.js gets a closure
  // over this box rather than the function directly.
  const disposeBag = { current: null };
  load(container, disposeBag);
  return () => disposeBag.current?.();
}

async function load(container, disposeBag) {
  renderLoading(container, "Loading your library…");
  try {
    const data = await apiFetch("/me/playlists?limit=50");
    renderLibrary(container, data.items || [], disposeBag);
  } catch (err) {
    renderError(container, err, () => load(container, disposeBag));
  }
}

// Nothing playing and no active device is the state new users land in, and
// the cause ("Spotify has to be open somewhere") isn't guessable from an
// empty player. Shown reactively rather than once, since opening Spotify
// elsewhere should make it disappear on the next poll.
function buildNoDeviceHint() {
  const hint = el("div", { class: "device-hint hidden" }, [
    el("p", { class: "device-hint-title", text: "Nothing is playing" }),
    el("p", {
      class: "device-hint-body",
      text: "Audio comes from the Spotify app. Open Spotify on a phone, computer or speaker, then pick it here.",
    }),
    el("button", { class: "btn-secondary", type: "button", text: "Choose device", onclick: openDeviceSheet }),
  ]);

  const sync = () => {
    const showHint = store.hasPolled && !store.playback;
    hint.classList.toggle("hidden", !showHint);
  };

  store.addEventListener("playback", sync);
  sync();

  return { hint, dispose: () => store.removeEventListener("playback", sync) };
}

function renderLibrary(container, playlists, disposeBag) {
  clear(container);

  const page = el("div", { class: "page page-library" });

  const { hint, dispose } = buildNoDeviceHint();
  disposeBag.current = dispose;
  page.appendChild(hint);

  const shortcuts = el("div", { class: "shortcut-row" }, [
    el(
      "button",
      { class: "shortcut-card shortcut-liked", type: "button", onclick: () => navigate("#/liked") },
      [el("span", { class: "shortcut-icon" }, [icon("heart", { size: 18 })]), el("span", { class: "shortcut-label", text: "Liked Songs" })]
    ),
    el(
      "button",
      { class: "shortcut-card shortcut-recent", type: "button", onclick: () => navigate("#/recent") },
      [el("span", { class: "shortcut-icon" }, [icon("clock", { size: 18 })]), el("span", { class: "shortcut-label", text: "Recently Played" })]
    ),
  ]);
  page.appendChild(shortcuts);

  page.appendChild(el("h2", { class: "section-heading", text: "Your Playlists" }));

  if (playlists.length === 0) {
    page.appendChild(el("p", { class: "state-message", text: "No playlists yet." }));
  } else {
    const grid = el("div", { class: "playlist-grid" });
    for (const playlist of playlists) {
      grid.appendChild(createPlaylistCard(playlist));
    }
    page.appendChild(grid);
  }

  container.appendChild(page);
}

function createPlaylistCard(playlist) {
  const art = pickImage(playlist.images, 300);
  return el(
    "button",
    {
      class: "playlist-card",
      type: "button",
      onclick: () => navigate(`#/playlist/${encodeURIComponent(playlist.id)}`),
    },
    [
      art
        ? el("img", { class: "playlist-card-art", src: art, alt: "", loading: "lazy" })
        : el("div", { class: "playlist-card-art playlist-card-art-placeholder" }),
      el("span", { class: "playlist-card-title", text: playlist.name || "Untitled playlist" }),
      el("span", { class: "playlist-card-subtitle", text: `${playlist.tracks?.total ?? playlist.items?.total ?? 0} tracks` }),
    ]
  );
}

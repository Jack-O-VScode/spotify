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

export function render(container) {
  load(container);
}

async function load(container) {
  renderLoading(container, "Loading your library…");
  try {
    const data = await apiFetch("/me/playlists?limit=50");
    renderLibrary(container, data.items || []);
  } catch (err) {
    renderError(container, err, () => load(container));
  }
}

function renderLibrary(container, playlists) {
  clear(container);

  const page = el("div", { class: "page page-library" });

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
      el("span", { class: "playlist-card-subtitle", text: `${playlist.tracks?.total ?? 0} tracks` }),
    ]
  );
}

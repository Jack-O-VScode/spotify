// ---------------------------------------------------------------------------
// "/search" route: find a track or playlist and play it straight away.
//
// Development Mode caps search results at 10 per type (a Spotify limit
// since the Feb 2026 changes, not a choice here), so this shows a single
// tight page of results rather than paginating.
// ---------------------------------------------------------------------------

import { apiFetch } from "../api.js";
import { el, clear } from "../dom.js";
import { pickImage } from "../format.js";
import { navigate } from "../router.js";
import { renderError } from "../components/async-states.js";
import { createTrackRow } from "../components/track-row.js";
import { play, addToQueue } from "../player.js";
import { icon } from "../icons.js";

const DEBOUNCE_MS = 350;
const LIMIT = 10;

export function render(container) {
  clear(container);

  const page = el("div", { class: "page page-search" });

  const input = el("input", {
    class: "search-input",
    type: "search",
    placeholder: "Songs, playlists…",
    spellcheck: "false",
    autocomplete: "off",
    autocapitalize: "none",
    enterkeyhint: "search",
  });

  page.appendChild(
    el("div", { class: "search-bar" }, [
      el("span", { class: "search-bar-icon" }, [icon("search", { size: 18 })]),
      input,
    ])
  );

  const results = el("div", { class: "search-results" });
  page.appendChild(results);
  container.appendChild(page);

  renderIdle(results);
  input.focus();

  let debounceTimer = null;
  // Guards against an earlier, slower request landing after a later one and
  // overwriting fresher results with stale ones.
  let requestId = 0;

  function runSearch() {
    const query = input.value.trim();
    if (!query) {
      requestId++;
      renderIdle(results);
      return;
    }
    const thisRequest = ++requestId;
    search(query, results, thisRequest, () => thisRequest === requestId);
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
  });
  input.addEventListener("search", runSearch);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      clearTimeout(debounceTimer);
      runSearch();
      input.blur();
    }
  });

  return () => clearTimeout(debounceTimer);
}

function renderIdle(container) {
  clear(container);
  container.appendChild(
    el("p", { class: "state-message", text: "Search your Spotify for something to play." })
  );
}

async function search(query, container, _id, isCurrent) {
  clear(container);
  container.appendChild(el("p", { class: "state-message", text: "Searching…" }));

  try {
    const data = await apiFetch(
      `/search?q=${encodeURIComponent(query)}&type=track,playlist&limit=${LIMIT}`
    );
    if (!isCurrent()) return;
    renderResults(container, data);
  } catch (err) {
    if (!isCurrent()) return;
    renderError(container, err, () => search(query, container, _id, isCurrent));
  }
}

function renderResults(container, data) {
  clear(container);

  const tracks = (data?.tracks?.items || []).filter(Boolean);
  const playlists = (data?.playlists?.items || []).filter(Boolean);

  if (tracks.length === 0 && playlists.length === 0) {
    container.appendChild(el("p", { class: "state-message", text: "Nothing found." }));
    return;
  }

  if (tracks.length > 0) {
    container.appendChild(el("h2", { class: "section-heading", text: "Songs" }));
    const list = el("div", { class: "track-list" });
    for (const track of tracks) {
      list.appendChild(createSearchTrackRow(track));
    }
    container.appendChild(list);
  }

  if (playlists.length > 0) {
    container.appendChild(el("h2", { class: "section-heading", text: "Playlists" }));
    const list = el("div", { class: "track-list" });
    for (const playlist of playlists) {
      list.appendChild(createSearchPlaylistRow(playlist));
    }
    container.appendChild(list);
  }
}

// A search hit has no surrounding context to play from, so it plays as a
// one-track queue rather than with a context_uri + offset.
function createSearchTrackRow(track) {
  return createTrackRow(track, {
    onPlay: () => play({ uris: [track.uri] }),
    onQueue: () => addToQueue(track.uri, track.name),
  });
}

function createSearchPlaylistRow(playlist) {
  const art = pickImage(playlist.images, 80);
  const owner = playlist.owner?.display_name;

  return el(
    "button",
    {
      class: "track-row",
      type: "button",
      onclick: () => navigate(`#/playlist/${encodeURIComponent(playlist.id)}`),
    },
    [
      art
        ? el("img", { class: "track-row-art", src: art, alt: "", loading: "lazy" })
        : el("div", { class: "track-row-art track-row-art-placeholder" }),
      el("div", { class: "track-row-text" }, [
        el("span", { class: "track-row-title", text: playlist.name || "Untitled playlist" }),
        el("span", { class: "track-row-artist", text: owner ? `Playlist · ${owner}` : "Playlist" }),
      ]),
    ]
  );
}

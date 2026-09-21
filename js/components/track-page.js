// ---------------------------------------------------------------------------
// Shared "paginated, tappable, highlight-the-playing-row track list" used by
// playlist detail, Liked Songs, and Recently Played — identical mechanics,
// differing only in the API path paged over and how a tap translates into a
// play() call (playlist context vs. a bare list of URIs).
// ---------------------------------------------------------------------------

import { el } from "../dom.js";
import { createTrackRow } from "./track-row.js";
import { createPager } from "../pager.js";
import { play } from "../player.js";
import { store } from "../state.js";
import { describeError } from "./async-states.js";

// getPlayArgs(absoluteIndex, loadedUris) -> args object for player.play()
export function mountTrackPage({ listEl, loadMoreButton, pagerPath, getPlayArgs, emptyMessage, mapItem }) {
  const pager = createPager(pagerPath);
  const loadedUris = []; // absoluteIndex -> uri
  const rowByIndex = new Map();

  const onPlaybackChange = () => updateHighlights(rowByIndex, loadedUris);
  store.addEventListener("playback", onPlaybackChange);

  async function loadNextPage() {
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "Loading…";
    loadMoreButton.title = "";
    try {
      const items = await pager.loadNext();
      for (const rawItem of items) {
        const track = mapItem ? mapItem(rawItem) : rawItem.track;
        if (!track) continue; // local files / removed tracks can come back null
        const absoluteIndex = loadedUris.length;
        loadedUris.push(track.uri);

        const row = createTrackRow(track, {
          isPlaying: isCurrentlyPlaying(track.uri),
          onPlay: () => play(getPlayArgs(absoluteIndex, loadedUris)),
        });
        rowByIndex.set(absoluteIndex, row);
        listEl.appendChild(row);
      }
      if (loadedUris.length === 0 && !pager.hasMore) {
        listEl.appendChild(el("p", { class: "state-message", text: emptyMessage }));
      }
      loadMoreButton.classList.toggle("hidden", !pager.hasMore);
    } catch (err) {
      loadMoreButton.textContent = "Retry";
      loadMoreButton.title = describeError(err);
    } finally {
      loadMoreButton.disabled = false;
      if (loadMoreButton.textContent === "Loading…") loadMoreButton.textContent = "Load more";
    }
  }

  loadMoreButton.addEventListener("click", loadNextPage);
  loadNextPage();

  return () => store.removeEventListener("playback", onPlaybackChange);
}

function isCurrentlyPlaying(uri) {
  return Boolean(store.playback?.is_playing && store.playback?.item?.uri === uri);
}

function updateHighlights(rowByIndex, loadedUris) {
  for (const [index, row] of rowByIndex.entries()) {
    row.classList.toggle("track-row-playing", isCurrentlyPlaying(loadedUris[index]));
  }
}

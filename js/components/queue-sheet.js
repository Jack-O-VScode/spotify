// ---------------------------------------------------------------------------
// "Up next" sheet: what Spotify will play after the current track. Read-only
// — Spotify's API can add to the queue but exposes no way to reorder or
// remove from it, so this shows the list rather than pretending to edit it.
// ---------------------------------------------------------------------------

import { el, clear } from "../dom.js";
import { apiFetch } from "../api.js";
import { pickImage, joinArtists, formatDuration } from "../format.js";
import { describeError } from "./async-states.js";
import { enableSwipeToDismiss } from "./swipe-dismiss.js";

let sheetEl = null;
let listEl = null;

function ensureMounted() {
  if (sheetEl) return;

  listEl = el("div", { class: "queue-list" });

  const handle = el("div", { class: "sheet-handle" });
  const content = el("div", { class: "sheet-content" }, [
    handle,
    el("h2", { class: "sheet-title", text: "Up next" }),
    listEl,
    el("button", { class: "btn-secondary sheet-close-button", type: "button", text: "Close", onclick: close }),
  ]);

  sheetEl = el("div", { class: "sheet sheet-hidden", id: "queue-sheet" }, [
    el("div", { class: "sheet-backdrop", onclick: close }),
    content,
  ]);

  enableSwipeToDismiss(handle, content, close);
  document.body.appendChild(sheetEl);
}

export async function open() {
  ensureMounted();
  sheetEl.classList.remove("sheet-hidden");
  clear(listEl);
  listEl.appendChild(el("p", { class: "state-message", text: "Loading…" }));

  try {
    const data = await apiFetch("/me/player/queue");
    render(data);
  } catch (err) {
    clear(listEl);
    listEl.appendChild(el("p", { class: "state-message", text: describeError(err) }));
  }
}

export function close() {
  sheetEl?.classList.add("sheet-hidden");
}

function render(data) {
  clear(listEl);

  const nowPlaying = data?.currently_playing;
  const upNext = (data?.queue || []).filter(Boolean);

  if (nowPlaying) {
    listEl.appendChild(el("p", { class: "queue-section-label", text: "Now playing" }));
    listEl.appendChild(createQueueRow(nowPlaying, true));
  }

  if (upNext.length === 0) {
    listEl.appendChild(
      el("p", { class: "state-message", text: "Nothing queued. Add tracks from search." })
    );
    return;
  }

  listEl.appendChild(el("p", { class: "queue-section-label", text: "Next up" }));
  for (const track of upNext) {
    listEl.appendChild(createQueueRow(track, false));
  }
}

function createQueueRow(track, isCurrent) {
  const art = pickImage(track.album?.images, 80);
  return el("div", { class: `track-row${isCurrent ? " track-row-playing" : ""}` }, [
    art
      ? el("img", { class: "track-row-art", src: art, alt: "", loading: "lazy" })
      : el("div", { class: "track-row-art track-row-art-placeholder" }),
    el("div", { class: "track-row-text" }, [
      el("span", { class: "track-row-title", text: track.name || "Unknown track" }),
      el("span", { class: "track-row-artist", text: joinArtists(track.artists) }),
    ]),
    el("span", { class: "track-row-duration", text: formatDuration(track.duration_ms) }),
  ]);
}

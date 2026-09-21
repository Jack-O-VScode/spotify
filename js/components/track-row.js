// ---------------------------------------------------------------------------
// A single tappable track row, used by playlist detail, Liked Songs,
// Recently Played and search. Shared so the four can't drift in behavior.
//
// With an `onQueue` handler the row splits into a large primary tap target
// and a small secondary one, rather than nesting a button inside a button.
// ---------------------------------------------------------------------------

import { el } from "../dom.js";
import { formatDuration, joinArtists, pickImage } from "../format.js";
import { icon } from "../icons.js";

export function createTrackRow(track, { isPlaying, onPlay, onQueue, subtitle } = {}) {
  const art = pickImage(track.album?.images, 80);

  const contents = [
    art
      ? el("img", { class: "track-row-art", src: art, alt: "", loading: "lazy" })
      : el("div", { class: "track-row-art track-row-art-placeholder" }),
    el("div", { class: "track-row-text" }, [
      el("span", { class: "track-row-title", text: track.name || "Unknown track" }),
      el("span", { class: "track-row-artist", text: subtitle || joinArtists(track.artists) }),
    ]),
    // "now playing" is communicated purely via the track-row-playing class
    // (green title) so it can be toggled as playback changes without
    // touching this row's children again.
    el("span", { class: "track-row-duration", text: formatDuration(track.duration_ms) }),
  ];

  const playingClass = isPlaying ? " track-row-playing" : "";

  if (!onQueue) {
    return el("button", { class: `track-row${playingClass}`, type: "button", onclick: onPlay }, contents);
  }

  return el("div", { class: `track-row track-row-with-action${playingClass}` }, [
    el("button", { class: "track-row-main", type: "button", onclick: onPlay }, contents),
    el(
      "button",
      {
        class: "track-row-action",
        type: "button",
        title: "Add to queue",
        "aria-label": `Add ${track.name || "track"} to queue`,
        onclick: onQueue,
      },
      [icon("queue", { size: 18 })]
    ),
  ]);
}

// ---------------------------------------------------------------------------
// A single tappable track row, used by playlist detail, Liked Songs, and
// Recently Played. Shared here so the three views can't drift in behavior.
// ---------------------------------------------------------------------------

import { el } from "../dom.js";
import { formatDuration, joinArtists, pickImage } from "../format.js";

export function createTrackRow(track, { isPlaying, onPlay }) {
  const art = pickImage(track.album?.images, 80);

  const row = el(
    "button",
    {
      class: `track-row${isPlaying ? " track-row-playing" : ""}`,
      type: "button",
      onclick: onPlay,
    },
    [
      art
        ? el("img", { class: "track-row-art", src: art, alt: "", loading: "lazy" })
        : el("div", { class: "track-row-art track-row-art-placeholder" }),
      el("div", { class: "track-row-text" }, [
        el("span", { class: "track-row-title", text: track.name || "Unknown track" }),
        el("span", { class: "track-row-artist", text: joinArtists(track.artists) }),
      ]),
      // "now playing" is communicated purely via the track-row-playing class
      // (green title + a bars icon from CSS) so it can be toggled later as
      // playback state changes, without touching this row's children again.
      el("span", { class: "track-row-duration", text: formatDuration(track.duration_ms) }),
    ]
  );

  return row;
}

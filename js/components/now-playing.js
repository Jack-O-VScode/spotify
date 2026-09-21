// ---------------------------------------------------------------------------
// The persistent mini now-playing bar (above the tab bar) and the
// full-screen player sheet it expands into. Both read from the same
// store.playback state kept fresh by player.js's polling.
//
// Progress is interpolated locally between polls (every 250ms while
// playing) so the scrubber moves smoothly instead of jumping every 3s.
// ---------------------------------------------------------------------------

import { el, clear } from "../dom.js";
import { formatDuration, joinArtists, pickImage } from "../format.js";
import { store } from "../state.js";
import { resume, pause, next, previous, seek, setShuffle, setRepeat, setVolume } from "../player.js";

import { open as openDeviceSheet } from "./device-sheet.js";
import { open as openQueueSheet } from "./queue-sheet.js";
import { icon } from "../icons.js";

function setIcon(button, name, size) {
  clear(button);
  button.appendChild(icon(name, { size }));
}

let miniBarEl = null;
let sheetEl = null;
let sheetOpen = false;

// Local interpolation clock: displayProgressMs is recomputed on every tick
// as syncBaseProgressMs + (time elapsed since lastSyncPerf), never mutated
// incrementally — otherwise a fixed lastSyncPerf plus a growing
// displayProgressMs would compound the elapsed offset on every tick.
let displayProgressMs = 0;
let syncBaseProgressMs = 0;
let lastSyncPerf = 0;
let isDragging = false;
let tickTimer = null;

// Element refs updated on each render
let refs = {};

export function init() {
  buildMiniBar();
  buildSheet();
  store.addEventListener("playback", onPlaybackUpdate);
  tickTimer = setInterval(tick, 250);
  render();
}

function onPlaybackUpdate() {
  if (!isDragging) {
    syncBaseProgressMs = store.playback?.progress_ms ?? 0;
    lastSyncPerf = performance.now();
    displayProgressMs = syncBaseProgressMs;
  }
  render();
}

function tick() {
  if (isDragging || !store.playback?.is_playing) return;
  const elapsed = performance.now() - lastSyncPerf;
  const durationMs = store.playback?.item?.duration_ms ?? 0;
  displayProgressMs = Math.min(syncBaseProgressMs + elapsed, durationMs);
  updateProgressUI();
}

function hasTrack() {
  return Boolean(store.playback?.item);
}

function buildMiniBar() {
  refs.miniArt = el("img", { class: "mini-bar-art", alt: "" });
  refs.miniTitle = el("span", { class: "mini-bar-title" });
  refs.miniArtist = el("span", { class: "mini-bar-artist" });
  refs.miniPlayPause = el("button", { class: "mini-bar-playpause", type: "button", onclick: handleTogglePlay });
  setIcon(refs.miniPlayPause, "play", 22);
  refs.miniProgress = el("div", { class: "mini-bar-progress-fill" });

  const miniPrevButton = el("button", { class: "mini-bar-transport", type: "button", onclick: stopPropAnd(previous) });
  setIcon(miniPrevButton, "previous", 20);

  const miniNextButton = el("button", { class: "mini-bar-transport", type: "button", onclick: stopPropAnd(next) });
  setIcon(miniNextButton, "next", 20);

  miniBarEl = el("div", { class: "mini-bar mini-bar-hidden", onclick: handleMiniBarClick }, [
    el("div", { class: "mini-bar-progress-track" }, [refs.miniProgress]),
    el("div", { class: "mini-bar-row" }, [
      refs.miniArt,
      el("div", { class: "mini-bar-text" }, [refs.miniTitle, refs.miniArtist]),
      miniPrevButton,
      refs.miniPlayPause,
      miniNextButton,
    ]),
  ]);

  document.body.appendChild(miniBarEl);
}

function handleMiniBarClick(e) {
  if (e.target.closest("button")) return;
  openSheet();
}

function stopPropAnd(fn) {
  return (e) => {
    e.stopPropagation();
    fn();
  };
}

function buildSheet() {
  refs.sheetArt = el("img", { class: "sheet-player-art", alt: "" });
  refs.sheetTitle = el("h2", { class: "sheet-player-title" });
  refs.sheetArtist = el("p", { class: "sheet-player-artist" });

  refs.progressRange = el("input", {
    class: "sheet-progress-range",
    type: "range",
    min: "0",
    max: "1000",
    value: "0",
  });
  refs.progressRange.addEventListener("pointerdown", () => (isDragging = true));
  refs.progressRange.addEventListener("input", () => {
    const durationMs = store.playback?.item?.duration_ms ?? 0;
    displayProgressMs = (Number(refs.progressRange.value) / 1000) * durationMs;
    updateProgressUI();
  });
  refs.progressRange.addEventListener("change", () => {
    seek(displayProgressMs);
    syncBaseProgressMs = displayProgressMs;
    lastSyncPerf = performance.now();
    isDragging = false;
  });

  refs.currentTimeLabel = el("span", { class: "sheet-time-current", text: "0:00" });
  refs.durationLabel = el("span", { class: "sheet-time-duration", text: "0:00" });

  refs.shuffleButton = el("button", { class: "transport-button transport-secondary", type: "button", onclick: handleShuffle });
  refs.repeatButton = el("button", { class: "transport-button transport-secondary", type: "button", onclick: handleRepeat });
  refs.prevButton = el("button", { class: "transport-button", type: "button", onclick: previous });
  refs.playPauseButton = el("button", { class: "transport-button transport-primary", type: "button", onclick: handleTogglePlay });
  refs.nextButton = el("button", { class: "transport-button", type: "button", onclick: next });
  setIcon(refs.shuffleButton, "shuffle", 18);
  setIcon(refs.repeatButton, "repeat", 18);
  setIcon(refs.prevButton, "previous", 26);
  setIcon(refs.playPauseButton, "play", 28);
  setIcon(refs.nextButton, "next", 26);

  const volumeLowIcon = el("span", { class: "volume-icon" });
  const volumeHighIcon = el("span", { class: "volume-icon" });
  volumeLowIcon.appendChild(icon("volume-low", { size: 16 }));
  volumeHighIcon.appendChild(icon("volume-high", { size: 16 }));

  refs.volumeRange = el("input", { class: "sheet-volume-range", type: "range", min: "0", max: "100", value: "100" });
  refs.volumeRange.addEventListener("change", () => setVolume(Number(refs.volumeRange.value)));
  refs.volumeRow = el("div", { class: "sheet-volume-row hidden" }, [volumeLowIcon, refs.volumeRange, volumeHighIcon]);

  refs.emptyState = el("div", { class: "sheet-empty-state hidden" }, [
    el("p", { text: "Nothing playing right now." }),
    el("p", { class: "state-message", text: "Pick a track from your library to get started." }),
  ]);

  refs.playerBody = el("div", { class: "sheet-player-body" }, [
    refs.sheetArt,
    refs.sheetTitle,
    refs.sheetArtist,
    el("div", { class: "sheet-progress-row" }, [refs.progressRange]),
    el("div", { class: "sheet-time-row" }, [refs.currentTimeLabel, refs.durationLabel]),
    el("div", { class: "transport-row" }, [
      refs.shuffleButton,
      refs.prevButton,
      refs.playPauseButton,
      refs.nextButton,
      refs.repeatButton,
    ]),
    refs.volumeRow,
  ]);

  sheetEl = el("div", { class: "sheet sheet-hidden", id: "now-playing-sheet" }, [
    el("div", { class: "sheet-backdrop", onclick: closeSheet }),
    el("div", { class: "sheet-content sheet-content-player" }, [
      el("div", { class: "sheet-handle" }),
      el("div", { class: "sheet-player-toolbar" }, [
        buildChevronButton(),
        el("div", { class: "sheet-toolbar-actions" }, [buildQueueButton(), buildDeviceButton()]),
      ]),
      refs.playerBody,
      refs.emptyState,
    ]),
  ]);

  document.body.appendChild(sheetEl);
}

function buildChevronButton() {
  const button = el("button", { class: "sheet-close-chevron", type: "button", onclick: closeSheet });
  button.appendChild(icon("chevronDown", { size: 26 }));
  return button;
}

function buildDeviceButton() {
  const button = el("button", { class: "sheet-device-button", type: "button", onclick: openDeviceSheet }, [
    icon("speaker", { size: 16 }),
    el("span", { text: "Devices" }),
  ]);
  return button;
}

function buildQueueButton() {
  return el("button", { class: "sheet-device-button", type: "button", onclick: openQueueSheet }, [
    icon("queue", { size: 16 }),
    el("span", { text: "Queue" }),
  ]);
}

function openSheet() {
  sheetOpen = true;
  sheetEl.classList.remove("sheet-hidden");
}

function closeSheet() {
  sheetOpen = false;
  sheetEl.classList.add("sheet-hidden");
}

function handleTogglePlay() {
  if (store.playback?.is_playing) pause();
  else resume();
}

function handleShuffle() {
  setShuffle(!store.playback?.shuffle_state);
}

const REPEAT_CYCLE = ["off", "context", "track"];
function handleRepeat() {
  const current = store.playback?.repeat_state || "off";
  const nextState = REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(current) + 1) % REPEAT_CYCLE.length];
  setRepeat(nextState);
}

function render() {
  const playback = store.playback;
  const playing = hasTrack();

  miniBarEl.classList.toggle("mini-bar-hidden", !playing);

  if (playing) {
    const art = pickImage(playback.item.album?.images, 80);
    if (art) refs.miniArt.src = art;
    refs.miniTitle.textContent = playback.item.name || "";
    refs.miniArtist.textContent = joinArtists(playback.item.artists);
    setIcon(refs.miniPlayPause, playback.is_playing ? "pause" : "play", 22);

    refs.sheetTitle.textContent = playback.item.name || "";
    refs.sheetArtist.textContent = joinArtists(playback.item.artists);
    const bigArt = pickImage(playback.item.album?.images, 500);
    if (bigArt) refs.sheetArt.src = bigArt;

    setIcon(refs.playPauseButton, playback.is_playing ? "pause" : "play", 28);
    refs.shuffleButton.classList.toggle("transport-active", Boolean(playback.shuffle_state));
    refs.repeatButton.classList.toggle("transport-active", (playback.repeat_state || "off") !== "off");
    setIcon(refs.repeatButton, playback.repeat_state === "track" ? "repeat-one" : "repeat", 18);

    const supportsVolume = playback.device?.supports_volume !== false;
    refs.volumeRow.classList.toggle("hidden", !supportsVolume);
    if (supportsVolume && document.activeElement !== refs.volumeRange && typeof playback.device?.volume_percent === "number") {
      refs.volumeRange.value = String(playback.device.volume_percent);
    }

    refs.playerBody.classList.remove("hidden");
    refs.emptyState.classList.add("hidden");
  } else {
    refs.playerBody.classList.add("hidden");
    refs.emptyState.classList.remove("hidden");
  }

  updateProgressUI();
}

function updateProgressUI() {
  const durationMs = store.playback?.item?.duration_ms ?? 0;
  const clamped = Math.max(0, Math.min(displayProgressMs, durationMs));

  refs.miniProgress.style.width = durationMs > 0 ? `${(clamped / durationMs) * 100}%` : "0%";

  if (!isDragging) {
    refs.progressRange.max = String(durationMs || 1000);
    refs.progressRange.value = String(clamped);
  }
  refs.currentTimeLabel.textContent = formatDuration(clamped);
  refs.durationLabel.textContent = formatDuration(durationMs);
}

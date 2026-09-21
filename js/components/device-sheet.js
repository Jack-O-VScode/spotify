// ---------------------------------------------------------------------------
// Bottom sheet for picking which Spotify Connect device to play on. Singleton
// component mounted once to <body>; open()/close() control visibility.
// Selecting a device either transfers active playback to it (if something's
// already playing) or just remembers it as the target for the next play tap.
// ---------------------------------------------------------------------------

import { el, clear } from "../dom.js";
import { loadDevices, transferPlayback } from "../player.js";
import { store } from "../state.js";
import { enableSwipeToDismiss } from "./swipe-dismiss.js";

let sheetEl = null;
let listEl = null;

function ensureMounted() {
  if (sheetEl) return;

  listEl = el("div", { class: "device-list" });

  const handle = el("div", { class: "sheet-handle" });
  const content = el("div", { class: "sheet-content" }, [
    handle,
    el("h2", { class: "sheet-title", text: "Select a device" }),
    listEl,
    el("button", { class: "btn-secondary sheet-close-button", type: "button", text: "Close", onclick: close }),
  ]);

  sheetEl = el("div", { class: "sheet sheet-hidden", id: "device-sheet" }, [
    el("div", { class: "sheet-backdrop", onclick: close }),
    content,
  ]);

  enableSwipeToDismiss(handle, content, close);
  document.body.appendChild(sheetEl);
  store.addEventListener("devices", renderDevices);
  store.addEventListener("selected-device", renderDevices);
}

export async function open() {
  ensureMounted();
  sheetEl.classList.remove("sheet-hidden");
  renderDevices(); // show stale list immediately, then refresh
  await loadDevices();
}

export function close() {
  sheetEl?.classList.add("sheet-hidden");
}

function renderDevices() {
  clear(listEl);
  const devices = store.devices;

  if (devices.length === 0) {
    listEl.appendChild(
      el("p", { class: "state-message", text: "No devices found. Open Spotify on a phone, computer, or speaker first." })
    );
    return;
  }

  for (const device of devices) {
    const isSelected = device.id === store.selectedDeviceId || device.is_active;
    // Spotify marks some devices (certain speakers, car systems) as
    // restricted, meaning the Web API can see them but cannot control them.
    // Showing them as selectable would just produce silent failures.
    const restricted = device.is_restricted === true;

    listEl.appendChild(
      el(
        "button",
        {
          class: `device-row${isSelected ? " device-row-selected" : ""}${restricted ? " device-row-restricted" : ""}`,
          type: "button",
          disabled: restricted ? "disabled" : null,
          onclick: () => selectDevice(device),
        },
        [
          el("span", { class: "device-row-icon", text: deviceIcon(device.type) }),
          el("div", { class: "device-row-text" }, [
            el("span", { class: "device-row-name", text: device.name }),
            el("span", {
              class: "device-row-meta",
              text: restricted
                ? "Can't be controlled from here"
                : device.is_active
                  ? "Currently playing"
                  : device.type,
            }),
          ]),
          isSelected && !restricted ? el("span", { class: "device-row-check", text: "✓" }) : null,
        ]
      )
    );
  }
}

function deviceIcon(type) {
  const key = (type || "").toLowerCase();
  if (key === "computer") return "💻";
  if (key === "smartphone") return "📱";
  if (key === "speaker") return "🔊";
  if (key === "tv") return "📺";
  return "🎵";
}

async function selectDevice(device) {
  store.setSelectedDeviceId(device.id);
  if (store.playback) {
    await transferPlayback(device.id, { play: Boolean(store.playback.is_playing) });
  }
  close();
}

// ---------------------------------------------------------------------------
// Playback engine: polls GET /me/player on an interval and fans state out
// via state.js, plus wraps every /me/player/* control endpoint. All the
// error handling (no device, rate limit, offline, needs Premium) lives here
// once instead of being re-implemented in every view/button.
// ---------------------------------------------------------------------------

import { apiFetch, RateLimitedError, OfflineError, NoActiveDeviceError, ApiError } from "./api.js";
import { AuthRequiredError } from "./auth.js";
import { store } from "./state.js";
import { showToast } from "./toast.js";

const POLL_INTERVAL_MS = 3000;
const POST_ACTION_REFRESH_DELAY_MS = 350;

let pollTimer = null;
let pollPausedUntil = 0;

// Registered from app.js rather than imported directly — device-sheet.js
// already imports from this module (loadDevices, transferPlayback), so a
// direct import back here would be circular. A callback avoids that while
// still letting a failed play attempt open the picker immediately instead
// of leaving the user with just a toast and no way to act on it (the
// now-playing bar/sheet, the only other entry point to the device picker,
// is hidden until something is already playing).
let noActiveDeviceHandler = null;
export function setNoActiveDeviceHandler(handler) {
  noActiveDeviceHandler = handler;
}

export function startPolling() {
  store.loadPersistedDeviceId();
  stopPolling();
  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function poll() {
  if (Date.now() < pollPausedUntil) return;
  try {
    const playback = await apiFetch("/me/player");
    store.setPlayback(playback);
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      // The global handler (registered via auth.js's onAuthRequired) takes
      // care of bouncing to the login screen; this loop just needs to stop
      // hammering an endpoint that will keep 401ing.
      stopPolling();
      return;
    }
    if (err instanceof NoActiveDeviceError) {
      store.setPlayback(null);
      return;
    }
    if (err instanceof RateLimitedError) {
      pollPausedUntil = Date.now() + err.retryAfterSeconds * 1000;
      return;
    }
    if (err instanceof OfflineError) {
      // Stay quiet on individual poll ticks while offline — a toast every
      // 3s would be worse than the stale UI. Actions the user actually
      // takes while offline still surface OfflineError to them directly.
      return;
    }
    // Unexpected error on a background poll: don't crash the app, just skip
    // this tick.
  }
}

function refreshSoon() {
  setTimeout(poll, POST_ACTION_REFRESH_DELAY_MS);
}

// Every control action shares this shape: fire the request, surface known
// errors as a toast (since these are triggered by a tap on visible UI, not
// a full-page action), then refresh playback state shortly after so the UI
// reflects the change faster than the next scheduled poll.
async function runAction(fn) {
  try {
    await fn();
    refreshSoon();
    return true;
  } catch (err) {
    handleActionError(err);
    return false;
  }
}

function handleActionError(err) {
  if (err instanceof AuthRequiredError) {
    // Global handler (see auth.js) already bounces to the login screen.
    return;
  }
  if (err instanceof NoActiveDeviceError) {
    showToast("No active device. Pick one to play on.", { variant: "warning" });
    if (noActiveDeviceHandler) noActiveDeviceHandler();
    return;
  }
  if (err instanceof RateLimitedError) {
    showToast(`Spotify says slow down — try again in ${err.retryAfterSeconds}s.`, { variant: "warning" });
    return;
  }
  if (err instanceof OfflineError) {
    showToast(err.message, { variant: "error" });
    return;
  }
  if (err instanceof ApiError) {
    // Spotify's own message (or the friendlier one api.js substitutes) is
    // already the useful part — prefixing it with "Something went wrong"
    // just buries it.
    showToast(err.message, { variant: "error" });
    return;
  }
  showToast(`Something went wrong: ${err.message}`, { variant: "error" });
}

function withDeviceQuery(path) {
  if (!store.selectedDeviceId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}device_id=${encodeURIComponent(store.selectedDeviceId)}`;
}

export function play({ contextUri, uris, offset } = {}) {
  const body = {};
  if (contextUri) body.context_uri = contextUri;
  if (uris) body.uris = uris;
  if (offset) body.offset = offset;
  return runAction(() =>
    apiFetch(withDeviceQuery("/me/player/play"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export function resume() {
  return runAction(() =>
    apiFetch(withDeviceQuery("/me/player/play"), { method: "PUT" })
  );
}

export function pause() {
  return runAction(() => apiFetch(withDeviceQuery("/me/player/pause"), { method: "PUT" }));
}

export function next() {
  return runAction(() => apiFetch(withDeviceQuery("/me/player/next"), { method: "POST" }));
}

export function previous() {
  return runAction(() => apiFetch(withDeviceQuery("/me/player/previous"), { method: "POST" }));
}

export function seek(positionMs) {
  return runAction(() =>
    apiFetch(withDeviceQuery(`/me/player/seek?position_ms=${Math.round(positionMs)}`), { method: "PUT" })
  );
}

export function setShuffle(state) {
  return runAction(() =>
    apiFetch(withDeviceQuery(`/me/player/shuffle?state=${state}`), { method: "PUT" })
  );
}

// Spotify cycles repeat through off -> context -> track.
export function setRepeat(state) {
  return runAction(() =>
    apiFetch(withDeviceQuery(`/me/player/repeat?state=${state}`), { method: "PUT" })
  );
}

export function setVolume(percent) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return runAction(() =>
    apiFetch(withDeviceQuery(`/me/player/volume?volume_percent=${clamped}`), { method: "PUT" })
  );
}

export async function loadDevices() {
  try {
    const data = await apiFetch("/me/player/devices");
    const devices = data?.devices || [];
    store.setDevices(devices);
    return devices;
  } catch (err) {
    handleActionError(err);
    return [];
  }
}

// Queues a track after whatever is playing. Confirms with a toast because
// unlike pressing play there's no visible change to show it worked.
export async function addToQueue(uri, trackName) {
  const ok = await runAction(() =>
    apiFetch(withDeviceQuery(`/me/player/queue?uri=${encodeURIComponent(uri)}`), { method: "POST" })
  );
  if (ok) {
    showToast(trackName ? `Queued “${trackName}”` : "Added to queue");
  }
  return ok;
}

export function transferPlayback(deviceId, { play: shouldPlay = false } = {}) {
  return runAction(() =>
    apiFetch("/me/player", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [deviceId], play: shouldPlay }),
    })
  );
}

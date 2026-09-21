// ---------------------------------------------------------------------------
// Thin wrapper around the Spotify Web API for authenticated requests.
// Centralizes: auth header injection + transparent token refresh, 429
// rate-limit backoff (honors Retry-After), and network/offline errors —
// so every feature built on top gets this handling for free.
// ---------------------------------------------------------------------------

import { getValidAccessToken, forceRefreshAccessToken, AuthRequiredError } from "./auth.js";

export const API_BASE = "https://api.spotify.com/v1";

// How long to wait when Spotify rate-limits us but we can't read how long
// for. `Retry-After` is not a CORS-safelisted response header, so a
// cross-origin fetch only sees it if the server sends
// Access-Control-Expose-Headers — which Spotify does not. Assuming one
// second (the old default) meant a rate-limited client carried on hammering
// the API; this is deliberately conservative instead.
const ASSUMED_RETRY_AFTER_SECONDS = 8;

export class RateLimitedError extends Error {
  constructor(retryAfterSeconds, known) {
    super(`Rate limited, retry after ${retryAfterSeconds}s`);
    this.retryAfterSeconds = retryAfterSeconds;
    // Distinguishes a real Retry-After from our fallback, so the UI can
    // avoid quoting a countdown it actually invented.
    this.known = known;
  }
}

export class OfflineError extends Error {
  constructor() {
    super("You're offline. Check your connection and try again.");
  }
}

export class NoActiveDeviceError extends Error {
  constructor() {
    super("No active Spotify device. Open Spotify on a device, then pick it here.");
  }
}

export class ApiError extends Error {
  // `path` and Spotify's own `reason` are carried along because a bare
  // "Forbidden" is undiagnosable — knowing *which* endpoint refused, and
  // why Spotify says it refused, is the difference between fixing this in
  // one round and guessing for three.
  constructor(status, message, { path, reason } = {}) {
    super(message);
    this.status = status;
    this.path = path;
    this.reason = reason;
  }
}

// path is relative to API_BASE, e.g. "/me" or "/me/playlists?limit=50".
// Retries once automatically after a token refresh on 401. Does not retry
// automatically on 429 — callers decide whether/how to retry, since that's
// a UX choice (e.g. queue silently vs. show a "slow down" toast).
export async function apiFetch(path, options = {}, { _retried = false } = {}) {
  let accessToken;
  try {
    accessToken = await getValidAccessToken();
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err;
    throw err;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (networkErr) {
    throw new OfflineError();
  }

  if (response.status === 401 && !_retried) {
    // Access token was rejected server-side even though we thought it was
    // valid (clock skew, revoked session, etc). Force a refresh and retry
    // exactly once.
    await forceRefreshAccessToken();
    return apiFetch(path, options, { _retried: true });
  }

  if (response.status === 429) {
    const header = Number(response.headers.get("Retry-After"));
    const known = Number.isFinite(header) && header > 0;
    throw new RateLimitedError(known ? header : ASSUMED_RETRY_AFTER_SECONDS, known);
  }

  if (response.status === 403) {
    const body = await safeJson(response);
    const reason = body?.error?.reason;
    if (reason === "PREMIUM_REQUIRED") {
      throw new ApiError(403, "This requires Spotify Premium.", { path, reason });
    }
    throw new ApiError(403, body?.error?.message || "Not permitted.", { path, reason });
  }

  if (response.status === 502 || response.status === 503) {
    // Spotify commonly returns these when the target Connect device has gone
    // away mid-request (app closed, device asleep) rather than because
    // Spotify itself is down, so say something the user can act on.
    throw new ApiError(
      response.status,
      "Spotify couldn't reach the device. Make sure the Spotify app is open on it, then try again.",
      { path }
    );
  }

  if (response.status === 404 && isDeviceRequiredEndpoint(path)) {
    // Spotify returns 404 for playback *control* endpoints when there's no
    // active device — but /me/player/devices and /me/player/recently-played
    // are plain read endpoints that don't need one, and a 404 there means
    // something else entirely (bad path, restricted endpoint, etc). Mapping
    // those to "no active device" too would hide the real error.
    throw new NoActiveDeviceError();
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(response.status, body?.error?.message || response.statusText, {
      path,
      reason: body?.error?.reason,
    });
  }

  if (response.status === 204) return null;
  return safeJson(response);
}

function isDeviceRequiredEndpoint(path) {
  return (
    path.startsWith("/me/player") &&
    !path.startsWith("/me/player/devices") &&
    !path.startsWith("/me/player/recently-played")
  );
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}


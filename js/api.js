// ---------------------------------------------------------------------------
// Thin wrapper around the Spotify Web API for authenticated requests.
// Centralizes: auth header injection + transparent token refresh, 429
// rate-limit backoff (honors Retry-After), and network/offline errors —
// so every feature built on top gets this handling for free.
// ---------------------------------------------------------------------------

import { getValidAccessToken, forceRefreshAccessToken, AuthRequiredError } from "./auth.js";

const API_BASE = "https://api.spotify.com/v1";

export class RateLimitedError extends Error {
  constructor(retryAfterSeconds) {
    super(`Rate limited, retry after ${retryAfterSeconds}s`);
    this.retryAfterSeconds = retryAfterSeconds;
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
  constructor(status, message) {
    super(message);
    this.status = status;
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
    const retryAfter = Number(response.headers.get("Retry-After") || "1");
    throw new RateLimitedError(retryAfter);
  }

  if (response.status === 403) {
    const body = await safeJson(response);
    if (body?.error?.reason === "PREMIUM_REQUIRED") {
      throw new ApiError(403, "This requires Spotify Premium.");
    }
    throw new ApiError(403, body?.error?.message || "Not permitted.");
  }

  if (response.status === 404 && path.startsWith("/me/player")) {
    // Spotify returns 404 for player endpoints when there's no active device.
    throw new NoActiveDeviceError();
  }

  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(response.status, body?.error?.message || response.statusText);
  }

  if (response.status === 204) return null;
  return safeJson(response);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}


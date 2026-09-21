// ---------------------------------------------------------------------------
// Authorization Code + PKCE flow, entirely client-side. See README for the
// step-by-step walkthrough. No client secret is used or stored anywhere.
// ---------------------------------------------------------------------------

import {
  CLIENT_ID,
  REDIRECT_URI,
  SCOPES,
  AUTHORIZE_ENDPOINT,
  TOKEN_ENDPOINT,
  TOKEN_STORAGE_KEY,
  PKCE_VERIFIER_KEY,
  OAUTH_STATE_KEY,
} from "./config.js";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "./pkce.js";

// Refresh this many seconds before actual expiry, so a request never races
// a token that's about to die mid-flight.
const REFRESH_SKEW_SECONDS = 60;

// A refresh already in flight, so concurrent API calls await the same
// promise instead of firing duplicate refresh requests.
let refreshInFlight = null;

export async function redirectToLogin() {
  const verifier = generateCodeVerifier();
  const state = generateState();
  const challenge = await generateCodeChallenge(verifier);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  });

  window.location.assign(`${AUTHORIZE_ENDPOINT}?${params.toString()}`);
}

// Call once on page load. If the URL carries an OAuth redirect (?code= or
// ?error=), consumes it: exchanges the code for tokens, cleans the URL, and
// returns a result the caller can render. Otherwise returns null.
export async function handleRedirectIfPresent() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const returnedState = url.searchParams.get("state");

  if (!code && !error) return null;

  // Always scrub the query string so a refresh doesn't replay a stale code.
  const cleanUrl = `${url.origin}${url.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);

  if (error) {
    return { ok: false, message: describeAuthError(error) };
  }

  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  if (!expectedState || returnedState !== expectedState) {
    return { ok: false, message: "Login could not be verified (state mismatch). Please try again." };
  }

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  if (!verifier) {
    return { ok: false, message: "Login session expired before it could complete. Please try again." };
  }

  try {
    const tokens = await exchangeCodeForTokens(code, verifier);
    storeTokens(tokens);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: `Could not complete login: ${err.message}` };
  }
}

async function exchangeCodeForTokens(code, verifier) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
  return tokenRequest(body);
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  return tokenRequest(body);
}

async function tokenRequest(body) {
  let response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (networkErr) {
    throw new Error("network unreachable");
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      detail = data.error_description || data.error || detail;
    } catch {
      // response body wasn't JSON; fall back to statusText
    }
    throw new Error(detail);
  }

  return response.json();
}

function storeTokens(tokens) {
  const existing = getStoredTokens();
  const record = {
    access_token: tokens.access_token,
    // Spotify only returns a new refresh_token sometimes; keep the old one
    // if this response didn't include a replacement.
    refresh_token: tokens.refresh_token || existing?.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(record));
}

function getStoredTokens() {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return getStoredTokens() !== null;
}

export function logout() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// Returns a valid access token, transparently refreshing first if it's
// expired or about to expire. Throws if there's no session or the refresh
// token itself has been revoked — callers should catch this and route to
// the login screen rather than crash.
export async function getValidAccessToken() {
  const tokens = getStoredTokens();
  if (!tokens) {
    throw new AuthRequiredError("Not logged in.");
  }

  const expiresInSeconds = (tokens.expires_at - Date.now()) / 1000;
  if (expiresInSeconds > REFRESH_SKEW_SECONDS) {
    return tokens.access_token;
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(tokens.refresh_token)
      .then((newTokens) => {
        storeTokens(newTokens);
        return newTokens.access_token;
      })
      .catch((err) => {
        logout();
        throw new AuthRequiredError(`Session expired: ${err.message}`);
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

// Unlike getValidAccessToken(), always hits the token endpoint regardless of
// the locally cached expiry. Used when the server rejects a token we thought
// was still valid (clock skew, early revocation) — the local expiry can't be
// trusted in that case.
export async function forceRefreshAccessToken() {
  const tokens = getStoredTokens();
  if (!tokens) {
    throw new AuthRequiredError("Not logged in.");
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(tokens.refresh_token)
      .then((newTokens) => {
        storeTokens(newTokens);
        return newTokens.access_token;
      })
      .catch((err) => {
        logout();
        throw new AuthRequiredError(`Session expired: ${err.message}`);
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

// A dead session (no tokens, or refresh itself failed/was revoked) can
// surface from any apiFetch call site — playback polling, a view's own
// fetch, a settings page profile lookup. Rather than have every call site
// remember to bounce back to the login screen, the error notifies a single
// app-level handler itself, registered once via onAuthRequired() below.
const authRequiredListeners = [];

export function onAuthRequired(handler) {
  authRequiredListeners.push(handler);
}

export class AuthRequiredError extends Error {
  constructor(message) {
    super(message);
    for (const listener of authRequiredListeners) listener();
  }
}

function describeAuthError(errorCode) {
  if (errorCode === "access_denied") {
    // Spotify returns access_denied both when someone taps Cancel and when
    // the account isn't on this app's test-user list — which, for an app in
    // Development Mode, is the far more confusing case to hit.
    return (
      "Login was cancelled or this Spotify account isn't allowed yet. " +
      "Apps in Development Mode only work for accounts added to their test-user list (max 5)."
    );
  }
  return `Spotify login failed (${errorCode}).`;
}

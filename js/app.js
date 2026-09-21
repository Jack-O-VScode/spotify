// ---------------------------------------------------------------------------
// Entry point for verifying the login flow end to end. This intentionally
// does NOT build any app UI yet (playlists, player, theming) — just enough
// to prove: login redirects out and back correctly, tokens are stored,
// GET /me succeeds, Premium status is detected, and logout clears state.
// The real UI gets layered on top of this once the flow is verified.
// ---------------------------------------------------------------------------

import { redirectToLogin, handleRedirectIfPresent, isLoggedIn, logout, AuthRequiredError } from "./auth.js";
import { apiFetch, RateLimitedError, OfflineError, ApiError } from "./api.js";

const root = document.getElementById("app");

async function main() {
  const redirectResult = await handleRedirectIfPresent();
  if (redirectResult && !redirectResult.ok) {
    renderError(redirectResult.message);
    return;
  }

  if (!isLoggedIn()) {
    renderLoggedOut();
    return;
  }

  await renderLoggedIn();
}

function renderLoggedOut() {
  root.innerHTML = "";
  const button = document.createElement("button");
  button.textContent = "Log in with Spotify";
  button.className = "login-button";
  button.addEventListener("click", () => {
    redirectToLogin();
  });
  root.appendChild(button);
}

async function renderLoggedIn() {
  root.innerHTML = "<p>Loading your profile…</p>";
  try {
    const profile = await apiFetch("/me");
    renderProfile(profile);
  } catch (err) {
    handleFetchError(err);
  }
}

function renderProfile(profile) {
  root.innerHTML = "";

  const isPremium = profile.product === "premium";

  const card = document.createElement("div");
  card.className = "profile-card";

  const name = document.createElement("h1");
  name.textContent = profile.display_name || profile.id;
  card.appendChild(name);

  const status = document.createElement("p");
  status.className = isPremium ? "premium-yes" : "premium-no";
  status.textContent = isPremium
    ? "Spotify Premium — playback control available."
    : "This account is not Premium. Playback control (play/pause/skip/volume) will not work — Spotify requires Premium for the player API. Browsing will still work.";
  card.appendChild(status);

  const logoutButton = document.createElement("button");
  logoutButton.textContent = "Log out";
  logoutButton.className = "logout-button";
  logoutButton.addEventListener("click", () => {
    logout();
    renderLoggedOut();
  });
  card.appendChild(logoutButton);

  root.appendChild(card);
}

function handleFetchError(err) {
  if (err instanceof AuthRequiredError) {
    renderLoggedOut();
    return;
  }
  if (err instanceof RateLimitedError) {
    renderError(`Spotify is rate-limiting us. Try again in ${err.retryAfterSeconds}s.`);
    return;
  }
  if (err instanceof OfflineError) {
    renderError(err.message);
    return;
  }
  if (err instanceof ApiError) {
    renderError(`Spotify API error: ${err.message}`);
    return;
  }
  renderError(`Unexpected error: ${err.message}`);
}

function renderError(message) {
  root.innerHTML = "";
  const banner = document.createElement("div");
  banner.className = "error-banner";
  banner.textContent = message;
  root.appendChild(banner);

  const button = document.createElement("button");
  button.textContent = "Back to login";
  button.className = "login-button";
  button.addEventListener("click", () => {
    logout();
    renderLoggedOut();
  });
  root.appendChild(button);
}

main();

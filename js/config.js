// ---------------------------------------------------------------------------
// App configuration
//
// CLIENT_ID is a public identifier — safe to ship in client-side JS. This app
// uses Authorization Code + PKCE, which is designed specifically so a public
// client (static site, no server) never needs a client secret. If you ever
// find yourself wanting to add one here, the auth flow has gone wrong.
//
// REDIRECT_URI is derived at runtime from the page's own URL so the exact
// same code works unmodified in dev (http://127.0.0.1:PORT/) and wherever
// it's hosted in production, without editing this file per environment.
// It resolves to the *directory* the page is served from, not just the
// origin, because static hosts differ on this: Cloudflare Pages serves from
// the domain root, but a GitHub Pages project site (repo not named
// <user>.github.io) serves from a subpath like https://user.github.io/repo/.
// new URL(".", location.href) handles both — and must always end in a
// trailing slash and exactly match a Redirect URI registered in the Spotify
// dashboard for this app.
//
// SCOPES is the full set of permissions requested at login for v1 (playlists,
// liked songs, recently played, playback read/control). Requesting them all
// up front avoids a second consent screen later when more UI is built on top
// of this auth flow.
// ---------------------------------------------------------------------------

export const CLIENT_ID = "69ac5ef024e8421c9a91820cdba63829";

export const REDIRECT_URI = new URL(".", window.location.href).href;

export const SCOPES = [
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-recently-played",
].join(" ");

export const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
export const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

export const TOKEN_STORAGE_KEY = "spotify_remote_tokens";
export const PKCE_VERIFIER_KEY = "spotify_remote_pkce_verifier";
export const OAUTH_STATE_KEY = "spotify_remote_oauth_state";

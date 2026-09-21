// ---------------------------------------------------------------------------
// App configuration
//
// CLIENT_ID is a public identifier — safe to ship in client-side JS. This app
// uses Authorization Code + PKCE, which is designed specifically so a public
// client (static site, no server) never needs a client secret. If you ever
// find yourself wanting to add one here, the auth flow has gone wrong.
//
// REDIRECT_URI is derived at runtime from the page's own origin so the exact
// same code works on http://127.0.0.1:PORT/ in dev and on the Cloudflare
// Pages URL in production, without editing this file per environment. It
// must always end in a trailing slash and must exactly match a Redirect URI
// registered in the Spotify dashboard for this app.
//
// SCOPES is the full set of permissions requested at login for v1 (playlists,
// liked songs, recently played, playback read/control). Requesting them all
// up front avoids a second consent screen later when more UI is built on top
// of this auth flow.
// ---------------------------------------------------------------------------

export const CLIENT_ID = "69ac5ef024e8421c9a91820cdba63829";

export const REDIRECT_URI = `${window.location.origin}/`;

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

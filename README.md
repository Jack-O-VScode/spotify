# Spotify Remote

A static, themeable web app that browses your Spotify library and controls
playback on whatever device your Spotify app is already running on. No
backend, no build step — plain HTML/CSS/JS served directly by a static host
(Cloudflare Pages, GitHub Pages, or just `python3 -m http.server` locally).

It's a *remote*, not a player: it uses the Spotify Web API's `/me/player/*`
endpoints to control an existing Spotify Connect session. It does not play
audio itself (no Web Playback SDK — that doesn't work in mobile browsers,
and iPhone is the primary target here). Open Spotify on your phone/speaker/
computer first, then use this app to browse and drive it.

## Features

- Log in with Spotify (Authorization Code + PKCE, no client secret, ever)
- Playlist grid with cover art → tap in for the track list → tap a track to play it
- Liked Songs and Recently Played
- Now-playing bar and full-screen player: art, progress (draggable), play/pause,
  previous/next, shuffle, repeat, volume (when the active device reports support for it)
- Device picker — choose which Spotify Connect device to play on
- Three switchable themes, persisted locally, plus instructions below for adding your own
- Installable as a PWA — "Add to Home Screen" on iOS launches fullscreen, no Safari chrome

## Requirements

- **Spotify Premium** on the account you log in with — the Web API's player
  control endpoints require it. A non-Premium account can still browse (see
  playlists, tracks) but playback control will visibly fail with an
  explanation rather than silently doing nothing.
- Your Spotify account must be added as a test user on this app in the
  [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) —
  it runs in Development Mode, which caps things at 5 authorized users.

## Local development

```
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000/` — it must be `127.0.0.1`, not
`localhost`, to match the registered Redirect URI. Ports 5173, 8000, and
5500 are all pre-registered.

## Deploying

Push this repo (or a branch of it) to Cloudflare Pages or GitHub Pages —
build command: none, output directory: repo root. Then add the deployed
URL, exactly as it loads (including the trailing slash), as a Redirect URI
in the Spotify Developer Dashboard. The app derives its own redirect URI at
runtime from wherever it's actually being served, including from a subpath
(e.g. a GitHub Pages project site at `https://user.github.io/repo/`), so no
code changes are needed between environments.

## How the pieces fit together

```
index.html              entry point; handles both the OAuth ?code= redirect and the app UI
css/themes.css           ALL theme colours/fonts/radii/spacing as CSS custom properties
css/styles.css           component styles — consumes those custom properties only
js/
  config.js              CLIENT_ID, derived REDIRECT_URI, scopes
  auth.js                PKCE login flow, token storage, transparent refresh
  api.js                 fetch wrapper: auth headers, 401 retry, 429/offline handling
  player.js               polls playback state, wraps every /me/player/* control call
  state.js                small pub-sub store playback/device state is read from
  router.js               hash-based router (#/library, #/playlist/:id, ...)
  theme.js                 applies/persists the active theme
  icons.js                inline SVG icon set (kept monochrome/theme-aware, unlike emoji)
  app.js                   shell: auth gate, tab bar, wires everything above together
  views/                   one file per route (library, playlist-detail, liked, recent, settings)
  components/              shared UI: track rows/pagination, now-playing bar+sheet, device sheet
```

## Adding a 4th theme

Everything a theme controls lives in `css/themes.css` as one block of CSS
custom properties per theme.

1. Open `css/themes.css` and copy one of the three
   `:root[data-theme="..."] { ... }` blocks end to end.
2. Change its selector to a new id, e.g. `:root[data-theme="sunset"]`.
3. Change the hex values. The spacing/radius/font tokens at the very top of
   the file are shared across all themes — leave those alone unless you
   specifically want different spacing too.
4. Open `js/theme.js` and add your theme to the `THEMES` array:
   ```js
   { id: "sunset", name: "Sunset" }
   ```
5. That's it — it now shows up as a fourth option in Settings, with no
   other file needing to change.

Nothing outside `css/themes.css` should ever contain a hardcoded colour —
component styles in `css/styles.css` only ever reference the custom
properties, so a new theme automatically applies everywhere. The one
deliberate exception is the theme-picker's own preview swatches in
Settings, which necessarily show each theme's actual colours regardless of
which theme is currently active.

## Known limitations

- Development Mode caps this app at 5 authorized Spotify accounts (a
  Spotify platform limit as of March 2026, not something this app
  controls).
- Playing from Liked Songs or Recently Played queues only the page of
  tracks currently loaded on screen (Spotify has no addressable
  "context" for either of those, unlike a playlist) — load more first if
  you want to start further in.
- No offline caching of library data; it re-fetches on each visit.

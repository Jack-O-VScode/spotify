# Spotify Remote

A static, themeable web app that browses your Spotify library and controls
playback on whatever device your Spotify app is already running on. No
backend, no build step — plain HTML/CSS/JS served directly by a static host
(GitHub Pages, Cloudflare Pages, or just `python3 -m http.server` locally).

It's a *remote*, not a player. It uses the Spotify Web API's `/me/player/*`
endpoints to drive an existing Spotify Connect session; it does not play
audio itself. Open Spotify on your phone, laptop or speaker, then use this
to browse and control it.

## Features

- Log in with Spotify (Authorization Code + PKCE, no client secret, ever)
- Playlist grid → track list → tap to play, with Play and Shuffle for the
  whole playlist
- Search for tracks and playlists
- Liked Songs and Recently Played (repeats collapsed)
- Add any track to the queue, and see what's coming up next
- Now-playing bar with previous / play-pause / next inline, expanding to a
  full player: draggable progress, shuffle, repeat, volume (when the device
  reports supporting it), and the album art blurred behind it
- Device picker for choosing which Spotify Connect device to play on
- Deep appearance customisation — see below
- Installable as a PWA, and loads offline once visited
- Keyboard shortcuts on desktop: space to play/pause, arrows to skip, `/`
  to search

## Requirements, and adding friends

- **Spotify Premium** on any account that logs in. The Web API's player
  control endpoints require it. Without Premium you can still browse, but
  playback control will fail with a clear message rather than silently
  doing nothing.
- **Every account must be added as a test user** in the
  [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
  under this app → Settings → User Management. Apps in Development Mode are
  capped at **5 users total**, a Spotify platform limit since March 2026.
  An account that isn't on the list can't log in — it gets bounced with an
  `access_denied` error, which the login screen explains.

## Local development

```
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/` — it must be `127.0.0.1`, not `localhost`, to
match a registered Redirect URI. Ports 5173, 8000 and 5500 are registered.

## Deploying

Push to GitHub Pages or Cloudflare Pages — build command: none, output
directory: repo root. Then add the deployed URL, exactly as it loads
(including the trailing slash), as a Redirect URI in the Spotify dashboard.
The app derives its own redirect URI at runtime from wherever it's served,
including a GitHub Pages project subpath, so no code changes are needed
between environments.

`.nojekyll` is present so GitHub Pages serves the files as-is instead of
running them through Jekyll.

**Confirming a deploy landed:** the bottom of Settings shows a build
version string (`js/version.js`). If a device seems to be running old code,
check that number before assuming a bug — bump it whenever you deploy
something you need to verify reached a device.

## Appearance

Settings → App colours. You pick three colours:

| Setting | What it covers |
|---|---|
| **Background** | Behind playlists and tracks. Solid, or a two-stop gradient. |
| **Bars** | The tab bar and the now-playing bar. |
| **Accent** | Play button, the playing track, active tabs. |

**Everything else is derived from those.** Text, secondary text, borders,
card surfaces, button label colours and shadows are all computed in
`js/color.js` from the WCAG relative luminance of what you chose — so a
light background flips the text dark automatically, and a colour picked too
close to its background gets nudged until it clears a usable contrast ratio
rather than becoming invisible. There is no combination that renders the
app unreadable.

Ten presets (System, Midnight, Ink, Paper, Ocean, Forest, Plum, Slate,
Dawn, Dusk) are one-tap starting points; editing any colour afterwards just
makes it a custom appearance. "System" follows the OS light/dark setting
live. Also in Settings: glass or solid bars, a font picker (only fonts
already on the device — nothing is downloaded), and a text size that scales
the whole app.

Appearance is stored per-device in `localStorage`; there's no backend, so
it doesn't follow your account to other devices.

### Adding a preset

A preset is only its three colours, so adding one means adding an entry to
`PRESETS` in `js/theme.js`:

```js
{
  id: "sunset",
  name: "Sunset",
  backgroundMode: "gradient",   // or "solid", with `background` instead
  backgroundTop: "#2b1055",
  backgroundBottom: "#ff6a3d",
  bar: "#1b0b33",
  accent: "#ffb347",
}
```

That's the whole change — it appears in Settings, the swatch draws itself,
and every derived colour follows. No CSS edit needed.

Design tokens themselves (spacing, radii, the default palette) live in
`css/themes.css`; `css/styles.css` only ever references those custom
properties and never hardcodes a colour, which is what lets an arbitrary
palette apply everywhere at once.

## How the pieces fit together

```
index.html               entry point; handles the OAuth ?code= redirect and the app UI
sw.js                    service worker — offline app shell, network-first
css/themes.css            design tokens + default palette
css/styles.css            component styles, custom properties only
js/
  config.js               CLIENT_ID, derived REDIRECT_URI, scopes
  auth.js                 PKCE login, token storage, transparent refresh
  api.js                  fetch wrapper: auth headers, 401 retry, 429/offline/502 handling
  color.js                contrast maths behind the derived palette
  theme.js                appearance settings, presets, token resolution
  player.js                playback polling and every /me/player/* control
  state.js                 pub-sub store for playback/device state
  router.js                hash router (#/library, #/playlist/:id, …)
  keyboard.js              desktop shortcuts
  icons.js                 inline SVG icon set
  app.js                   shell: auth gate, tab bar, wiring
  views/                   one file per route
  components/              shared UI: track rows, sheets, now-playing bar
```

## Known limitations

- Development Mode caps the app at 5 authorized Spotify accounts.
- Audio cannot play in this web app on iPhone or iPad. The only way a
  browser can play Spotify audio is the Web Playback SDK, which needs DRM
  support iOS Safari doesn't have. Something running the Spotify app has to
  be the speaker — though that can be the same device, with Spotify simply
  open in the background.
- The device picker only lists devices where Spotify is currently open.
  That's how Spotify Connect works and can't be worked around here.
- Playing from Liked Songs, Recently Played or a search result covers the
  tracks loaded on screen (Spotify has no addressable "context" for those,
  unlike a playlist) — load more first to start further in.
- The queue is read-only; the API can add to it but not reorder or remove.

## A note on Spotify's own API instability

Spotify's Web API has changed repeatedly through 2025–2026 for apps in
Development Mode: endpoint removals, renames (`/playlists/{id}/tracks` →
`/playlists/{id}/items`), field renames (`tracks.total` → `items.total`)
and tighter access limits with each policy update. The rollout has not been
uniform across accounts, so this app requests playlist items from the new
path and falls back to the old one on a 403/404 rather than betting on
either.

If a view that used to work starts showing an error, it surfaces Spotify's
own message plus the failing endpoint — worth checking
[the Web API changelog](https://developer.spotify.com/documentation/web-api/references/changes)
before assuming it's a bug here. Several of these breaks landed on every
third-party app at once.

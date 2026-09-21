// ---------------------------------------------------------------------------
// Service worker: offline support for the app shell.
//
// Deliberately NETWORK-FIRST for this app's own files rather than the more
// common cache-first. Cache-first would serve last visit's JavaScript on
// every load, which is exactly the stale-code failure mode that made an
// already-fixed API bug look unfixed for two rounds. Correctness of what
// ships beats shaving a few hundred milliseconds off a warm load; the cache
// is a fallback for being offline, not the primary source.
//
// Spotify's API and accounts hosts are never cached — those carry live
// playback state and auth, and a stale answer there is worse than no answer.
// ---------------------------------------------------------------------------

const CACHE_NAME = "spotify-remote-2026-09-22.7";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/themes.css",
  "./css/styles.css",
  "./js/app.js",
  "./js/api.js",
  "./js/auth.js",
  "./js/color.js",
  "./js/config.js",
  "./js/dom.js",
  "./js/format.js",
  "./js/icons.js",
  "./js/keyboard.js",
  "./js/pager.js",
  "./js/pkce.js",
  "./js/player.js",
  "./js/router.js",
  "./js/state.js",
  "./js/theme.js",
  "./js/toast.js",
  "./js/version.js",
  "./js/components/async-states.js",
  "./js/components/device-sheet.js",
  "./js/components/now-playing.js",
  "./js/components/queue-sheet.js",
  "./js/components/swipe-dismiss.js",
  "./js/components/track-page.js",
  "./js/components/track-row.js",
  "./js/views/library.js",
  "./js/views/liked.js",
  "./js/views/playlist-detail.js",
  "./js/views/recent.js",
  "./js/views/search.js",
  "./js/views/settings.js",
  "./icons/icon-192.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // addAll rejects the whole batch if any single file 404s, which would
      // leave the app with no offline cache at all over one renamed file.
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Live data and auth: always straight to the network, never cached.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // A navigation while offline with nothing matching: fall back to the
        // shell so the app still boots and can show its own offline state.
        if (request.mode === "navigate") {
          const shell = await caches.match("./index.html");
          if (shell) return shell;
        }
        throw new Error("offline and not cached");
      })
  );
});

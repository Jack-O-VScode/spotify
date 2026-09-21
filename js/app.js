// ---------------------------------------------------------------------------
// App shell: auth gate, tab bar + routed view container (Spotify-app-like
// navigation), and wiring for the persistent now-playing bar/sheet, device
// sheet, and playback polling. Individual features live in js/views/*.
// ---------------------------------------------------------------------------

import { redirectToLogin, handleRedirectIfPresent, isLoggedIn, logout, onAuthRequired } from "./auth.js";
import { initTheme } from "./theme.js";
import { el, clear } from "./dom.js";
import { registerRoute, initRouter, handleRouteChange, navigate, currentBaseRoute } from "./router.js";
import * as library from "./views/library.js";
import * as playlistDetail from "./views/playlist-detail.js";
import * as liked from "./views/liked.js";
import * as recent from "./views/recent.js";
import * as search from "./views/search.js";
import * as settings from "./views/settings.js";
import * as nowPlaying from "./components/now-playing.js";
import { startPolling, stopPolling, setNoActiveDeviceHandler } from "./player.js";
import { open as openDeviceSheet } from "./components/device-sheet.js";
import { showToast } from "./toast.js";
import { icon } from "./icons.js";

setNoActiveDeviceHandler(openDeviceSheet);

const root = document.getElementById("app");

initTheme();

// Registered once, before any fetch can possibly fire: a dead session
// (revoked refresh token, or none at all) can be discovered by playback
// polling, a view's data fetch, or the settings profile lookup alike, and
// all of them should land here rather than each view handling it themselves.
onAuthRequired(handleGlobalAuthRequired);

async function main() {
  const redirectResult = await handleRedirectIfPresent();
  if (redirectResult && !redirectResult.ok) {
    renderLoginScreen(redirectResult.message);
    return;
  }

  if (!isLoggedIn()) {
    renderLoginScreen();
    return;
  }

  renderAppShell();
}

function renderLoginScreen(errorMessage) {
  stopPolling();
  clear(root);

  const screen = el("div", { class: "login-screen" }, [
    errorMessage ? el("div", { class: "error-banner", text: errorMessage }) : null,
    el("div", { class: "login-brand" }, [
      el("div", { class: "login-logo" }, "♫"),
      el("h1", { class: "login-title", text: "Spotify Remote" }),
      el("p", { class: "login-subtitle", text: "Your library, your playback, your look." }),
    ]),
    el("button", { class: "login-button", type: "button", text: "Log in with Spotify", onclick: () => redirectToLogin() }),
  ]);

  root.appendChild(screen);
}

let authRequiredHandled = false;
function handleGlobalAuthRequired() {
  // Several in-flight requests can all discover the dead session around the
  // same moment (a poll tick plus a view fetch, say) — only react once.
  if (authRequiredHandled) return;
  authRequiredHandled = true;
  showToast("Your session expired. Please log in again.", { variant: "error" });
  logout();
  renderLoginScreen();
}

function renderAppShell() {
  clear(root);

  const viewContainer = el("div", { class: "view-container" });

  const tabs = [
    {
      route: "#/library",
      label: "Library",
      iconName: "library",
      // Playlist detail, Liked Songs and Recently Played are all reached
      // from Library, so they keep that tab lit.
      matches: (base) => base !== "/settings" && base !== "/search",
    },
    { route: "#/search", label: "Search", iconName: "search", matches: (base) => base === "/search" },
    { route: "#/settings", label: "Settings", iconName: "settings", matches: (base) => base === "/settings" },
  ];

  const tabButtons = tabs.map((tab) =>
    el("button", { class: "tab-button", type: "button", onclick: () => navigate(tab.route) }, [
      el("span", { class: "tab-icon" }, [icon(tab.iconName, { size: 22 })]),
      el("span", { class: "tab-label", text: tab.label }),
    ])
  );

  const tabBar = el("nav", { class: "tab-bar" }, tabButtons);

  function updateActiveTab() {
    const base = currentBaseRoute();
    tabs.forEach((tab, i) => tabButtons[i].classList.toggle("tab-button-active", tab.matches(base)));
  }

  root.appendChild(viewContainer);
  root.appendChild(tabBar);

  registerRoutesOnce();
  initRouter(viewContainer);
  window.addEventListener("hashchange", updateActiveTab);
  handleRouteChange();
  updateActiveTab();

  nowPlaying.init();
  startPolling();
}

let routesRegistered = false;
function registerRoutesOnce() {
  if (routesRegistered) return;
  routesRegistered = true;
  registerRoute("/library", library.render);
  registerRoute("/playlist/:id", playlistDetail.render);
  registerRoute("/liked", liked.render);
  registerRoute("/recent", recent.render);
  registerRoute("/search", search.render);
  registerRoute("/settings", settings.render);
}

// Registered after boot so a service-worker failure can never keep the app
// itself from starting. Scope is relative, which keeps it working under a
// GitHub Pages project subpath as well as at a domain root.
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Offline support is a bonus; the app works fine without it.
    });
  });
}

main();
registerServiceWorker();

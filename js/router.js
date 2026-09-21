// ---------------------------------------------------------------------------
// Minimal hash router. Hash-based on purpose: static hosts (GitHub Pages,
// Cloudflare Pages) need no server-side rewrite rules for a path-based SPA,
// and it can't collide with the ?code=&state= query string Spotify appends
// on the OAuth redirect back to "/".
//
// Routes are registered as { pattern, render(container, params) }. pattern
// segments starting with ":" are captured as params, e.g. "/playlist/:id".
// ---------------------------------------------------------------------------

const routes = [];
let currentCleanup = null;
let container = null;

export function registerRoute(pattern, render) {
  const segments = pattern.split("/").filter(Boolean);
  routes.push({ segments, render });
}

export function initRouter(viewContainer) {
  container = viewContainer;
  window.addEventListener("hashchange", handleRouteChange);
}

export function navigate(hash) {
  if (window.location.hash === hash) {
    handleRouteChange();
  } else {
    window.location.hash = hash;
  }
}

export function handleRouteChange() {
  const raw = window.location.hash.replace(/^#/, "") || "/library";
  const pathSegments = raw.split("/").filter(Boolean);

  for (const route of routes) {
    const params = matchRoute(route.segments, pathSegments);
    if (params) {
      if (typeof currentCleanup === "function") {
        currentCleanup();
        currentCleanup = null;
      }
      container.scrollTop = 0;
      const result = route.render(container, params);
      if (typeof result === "function") currentCleanup = result;
      return;
    }
  }

  // No match: fall back to the library view rather than showing a blank page.
  navigate("#/library");
}

function matchRoute(routeSegments, pathSegments) {
  if (routeSegments.length !== pathSegments.length) return null;
  const params = {};
  for (let i = 0; i < routeSegments.length; i++) {
    const routeSeg = routeSegments[i];
    if (routeSeg.startsWith(":")) {
      params[routeSeg.slice(1)] = decodeURIComponent(pathSegments[i]);
    } else if (routeSeg !== pathSegments[i]) {
      return null;
    }
  }
  return params;
}

export function currentBaseRoute() {
  const raw = window.location.hash.replace(/^#/, "") || "/library";
  return "/" + (raw.split("/").filter(Boolean)[0] || "library");
}

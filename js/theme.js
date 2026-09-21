// ---------------------------------------------------------------------------
// Runtime theme switching. The visual definitions live entirely in
// css/themes.css as custom properties — this file just toggles which one is
// active (via the html element's data-theme attribute) and persists the
// choice. To add a theme here, add its { id, name } and a matching block in
// css/themes.css — see the comment at the top of that file.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "spotify_remote_theme";
const DEFAULT_THEME = "midnight";

export const THEMES = [
  { id: "midnight", name: "Midnight" },
  { id: "daylight", name: "Daylight" },
  { id: "neon", name: "Neon" },
];

export function getCurrentTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (THEMES.some((t) => t.id === stored)) return stored;
  } catch {
    // localStorage unavailable (private mode, etc) — fall through to default
  }
  return DEFAULT_THEME;
}

export function applyTheme(themeId) {
  const theme = THEMES.some((t) => t.id === themeId) ? themeId : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // best-effort persistence; theme still applies for this session
  }
}

export function initTheme() {
  applyTheme(getCurrentTheme());
}

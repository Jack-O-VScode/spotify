// ---------------------------------------------------------------------------
// Appearance engine.
//
// The user picks three colours (background, bar, accent) plus a handful of
// look options; everything else the UI needs — text, secondary text,
// borders, card surfaces, button label colours, shadows — is derived from
// those so any combination stays legible. See js/color.js for the maths.
//
// The resolved token map is persisted alongside the settings so the inline
// boot script in index.html can apply it before first paint without
// re-running any of this.
// ---------------------------------------------------------------------------

import {
  normalizeHex,
  readableTextOn,
  softenedText,
  elevate,
  withAlpha,
  ensureContrast,
  isLight,
  mix,
} from "./color.js";

export const STORAGE_KEY = "spotify_remote_appearance";

// Each preset is just the three colours plus a background mode — the same
// shape the user edits by hand. "Adding a preset" means adding an entry
// here and nothing else.
export const PRESETS = [
  {
    id: "system",
    name: "System",
    system: true, // resolves to ink/paper based on the OS setting
  },
  {
    id: "midnight",
    name: "Midnight",
    backgroundMode: "solid",
    background: "#121212",
    bar: "#181818",
    accent: "#1db954",
  },
  {
    id: "ink",
    name: "Ink",
    backgroundMode: "solid",
    background: "#0a0a0c",
    bar: "#15151a",
    accent: "#5b8cff",
  },
  {
    id: "paper",
    name: "Paper",
    backgroundMode: "solid",
    background: "#faf9f6",
    bar: "#ffffff",
    accent: "#1a8f4c",
  },
  {
    id: "ocean",
    name: "Ocean",
    backgroundMode: "gradient",
    backgroundTop: "#04121f",
    backgroundBottom: "#0a4f7a",
    bar: "#06304d",
    accent: "#38bde0",
  },
  {
    id: "forest",
    name: "Forest",
    backgroundMode: "gradient",
    backgroundTop: "#081410",
    backgroundBottom: "#14402a",
    bar: "#10241a",
    accent: "#4fce7c",
  },
  {
    id: "plum",
    name: "Plum",
    backgroundMode: "gradient",
    backgroundTop: "#000000",
    backgroundBottom: "#61187c",
    bar: "#474747",
    accent: "#c964e8",
  },
  {
    id: "slate",
    name: "Slate",
    backgroundMode: "solid",
    background: "#1b1f24",
    bar: "#262c33",
    accent: "#8fb0cc",
  },
  {
    id: "dawn",
    name: "Dawn",
    backgroundMode: "gradient",
    backgroundTop: "#fdf1ec",
    backgroundBottom: "#f3c7cf",
    bar: "#ffffff",
    accent: "#c2456b",
  },
  {
    id: "dusk",
    name: "Dusk",
    backgroundMode: "gradient",
    backgroundTop: "#100b22",
    backgroundBottom: "#3a2a5f",
    bar: "#1b1436",
    accent: "#a98cf0",
  },
];

export const FONT_OPTIONS = [
  { value: "", label: "System default" },
  { value: "Georgia", label: "Georgia" },
  { value: "Palatino", label: "Palatino" },
  { value: "Baskerville", label: "Baskerville" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Hoefler Text", label: "Hoefler Text" },
  { value: "Didot", label: "Didot" },
  { value: "Helvetica Neue", label: "Helvetica Neue" },
  { value: "Avenir Next", label: "Avenir Next" },
  { value: "Futura", label: "Futura" },
  { value: "Gill Sans", label: "Gill Sans" },
  { value: "Optima", label: "Optima" },
  { value: "Verdana", label: "Verdana" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "American Typewriter", label: "American Typewriter" },
  { value: "Courier New", label: "Courier New" },
  { value: "Menlo", label: "Menlo" },
];

export const TEXT_SIZES = [
  { id: "small", name: "Small", scale: 0.9 },
  { id: "normal", name: "Normal", scale: 1 },
  { id: "large", name: "Large", scale: 1.15 },
];

const DEFAULT_PRESET_ID = "midnight";

export function defaultSettings() {
  return {
    ...settingsFromPreset(DEFAULT_PRESET_ID),
    buttons: "solid",
    font: "",
    textSize: "normal",
  };
}

function resolvePreset(presetId) {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) return PRESETS.find((p) => p.id === DEFAULT_PRESET_ID);
  if (!preset.system) return preset;

  const prefersLight =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  return PRESETS.find((p) => p.id === (prefersLight ? "paper" : "ink"));
}

export function settingsFromPreset(presetId) {
  const preset = resolvePreset(presetId);
  const mode = preset.backgroundMode || "solid";
  return {
    preset: presetId,
    backgroundMode: mode,
    background: preset.background || preset.backgroundTop || "#121212",
    backgroundTop: preset.backgroundTop || preset.background || "#121212",
    backgroundBottom: preset.backgroundBottom || preset.background || "#121212",
    bar: preset.bar,
    accent: preset.accent,
  };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.settings) return { ...defaultSettings(), ...parsed.settings };
    }
  } catch {
    // corrupt or unavailable storage — fall through to defaults
  }
  return defaultSettings();
}

export function saveSettings(settings) {
  const tokens = resolveTokens(settings);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, tokens }));
  } catch {
    // best-effort; the appearance still applies for this session
  }
  return tokens;
}

// The single source of truth for "what does this settings object actually
// look like". index.html's boot script applies the cached output of this
// before first paint; everything else calls it through applySettings().
export function resolveTokens(settings) {
  const mode = settings.backgroundMode === "gradient" ? "gradient" : "solid";
  const bgTop = normalizeHex(settings.backgroundTop, "#121212");
  const bgBottom = normalizeHex(settings.backgroundBottom, "#121212");
  const bgSolid = normalizeHex(settings.background, "#121212");

  // For a gradient, contrast decisions are made against the midpoint so
  // text stays readable at both ends rather than only at the top.
  const bgBase = mode === "gradient" ? mix(bgTop, bgBottom, 0.5) : bgSolid;

  const bar = normalizeHex(settings.bar, "#181818");
  const accentRaw = normalizeHex(settings.accent, "#1db954");
  const accent = ensureContrast(accentRaw, bgBase, 2.6);

  const text = readableTextOn(bgBase);
  const barText = readableTextOn(bar);
  const lightUI = isLight(bgBase);

  const textSize = TEXT_SIZES.find((t) => t.id === settings.textSize) || TEXT_SIZES[1];

  const surface = elevate(bgBase, lightUI ? 0.06 : 0.1);
  const surfaceHover = elevate(bgBase, lightUI ? 0.12 : 0.17);

  return {
    "--color-bg": mode === "gradient" ? bgTop : bgSolid,
    "--bg-image":
      mode === "gradient" ? `linear-gradient(180deg, ${bgTop} 0%, ${bgBottom} 100%)` : "none",
    "--color-bg-elevated": bar,
    "--color-bar-text": barText,
    "--color-bar-text-secondary": softenedText(bar, 0.35),
    "--color-surface": surface,
    "--color-surface-hover": surfaceHover,
    "--color-border": elevate(bgBase, lightUI ? 0.14 : 0.18),
    "--color-text": text,
    "--color-text-secondary": softenedText(bgBase, 0.32),
    "--color-text-tertiary": softenedText(bgBase, 0.52),
    "--color-accent": accent,
    "--color-accent-hover": mix(accent, text, 0.18),
    "--color-on-accent": readableTextOn(accent),
    "--color-error": ensureContrast(lightUI ? "#c0273c" : "#ff6b7e", bgBase, 3),
    "--color-error-bg": mix(bgBase, lightUI ? "#c0273c" : "#ff6b7e", 0.16),
    "--color-warning": ensureContrast(lightUI ? "#8a5a00" : "#ffc247", bgBase, 3),
    "--glass-bar": withAlpha(bar, 0.72),
    "--glass-surface": withAlpha(surface, 0.68),
    "--shadow-card": lightUI
      ? "0 2px 10px rgba(0, 0, 0, 0.12)"
      : "0 4px 14px rgba(0, 0, 0, 0.45)",
    "--shadow-sheet": lightUI
      ? "0 -8px 28px rgba(0, 0, 0, 0.16)"
      : "0 -8px 28px rgba(0, 0, 0, 0.55)",
    "--font-family": settings.font
      ? `"${settings.font}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      : `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`,
    "--text-scale": String(textSize.scale),
  };
}

export function applyTokens(tokens) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }
}

export function applySettings(settings) {
  const tokens = saveSettings(settings);
  applyTokens(tokens);
  document.documentElement.setAttribute("data-buttons", settings.buttons === "glass" ? "glass" : "solid");
  document.documentElement.setAttribute("data-appearance", isLight(tokens["--color-bg"]) ? "light" : "dark");
  // Keeps the iOS status bar / browser chrome in step with the app.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", tokens["--color-bg-elevated"]);
  return tokens;
}

export function initTheme() {
  const settings = loadSettings();
  applySettings(settings);

  // A "System" preset should follow the OS switching light/dark at runtime,
  // not just at load.
  if (settings.preset === "system" && window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
      const current = loadSettings();
      if (current.preset !== "system") return;
      applySettings({ ...current, ...settingsFromPreset("system") });
    });
  }
  return settings;
}

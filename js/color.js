// ---------------------------------------------------------------------------
// Colour maths for the theme engine. The point of all of this: the user can
// pick any background/bar/accent colour they like, and text, borders and
// button labels get derived from those picks so nothing ever ends up
// unreadable (white-on-cream, black-on-navy, etc).
// ---------------------------------------------------------------------------

const NEAR_WHITE = "#ffffff";
const NEAR_BLACK = "#0d0d0f";

export function normalizeHex(value, fallback = "#000000") {
  if (typeof value !== "string") return fallback;
  let hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
  return `#${hex.toLowerCase()}`;
}

export function hexToRgb(hex) {
  const clean = normalizeHex(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// WCAG relative luminance.
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(hexA, hexB) {
  const a = luminance(hexA);
  const b = luminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isLight(hex) {
  return luminance(hex) > 0.45;
}

// t = 0 returns hexA, t = 1 returns hexB.
export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Picks whichever of near-white / near-black reads better on the given
// background. This is the guarantee that a user-chosen colour can't make
// the app illegible.
export function readableTextOn(backgroundHex) {
  return contrastRatio(backgroundHex, NEAR_WHITE) >= contrastRatio(backgroundHex, NEAR_BLACK)
    ? NEAR_WHITE
    : NEAR_BLACK;
}

// A slightly-toward-the-background version of the readable text colour, for
// secondary/tertiary copy that should recede without disappearing.
export function softenedText(backgroundHex, amount) {
  return mix(readableTextOn(backgroundHex), backgroundHex, amount);
}

// Nudges a colour toward its readable text colour — used to derive card and
// border colours that sit just off the background, in whichever direction
// actually shows up against it.
export function elevate(backgroundHex, amount) {
  return mix(backgroundHex, readableTextOn(backgroundHex), amount);
}

// Guarantees an accent stays visible against the surface it sits on. If the
// user picks something with almost no contrast (black accent on a near-black
// background), this walks it toward the readable direction until it clears a
// usable ratio, instead of rendering an invisible play button.
export function ensureContrast(colorHex, againstHex, minRatio = 3) {
  let result = normalizeHex(colorHex);
  if (contrastRatio(result, againstHex) >= minRatio) return result;

  const target = readableTextOn(againstHex);
  for (let step = 1; step <= 20; step++) {
    result = mix(normalizeHex(colorHex), target, step / 20);
    if (contrastRatio(result, againstHex) >= minRatio) return result;
  }
  return target;
}

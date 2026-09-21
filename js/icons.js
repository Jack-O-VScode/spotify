// ---------------------------------------------------------------------------
// Small inline SVG icon set. Emoji glyphs render as full-colour pictures on
// iOS regardless of CSS `color`, which looks cartoonish against a flat
// themed UI — these use currentColor so they properly pick up
// var(--color-text)/var(--color-accent) etc. like real Spotify iconography.
// ---------------------------------------------------------------------------

const SVG_NS = "http://www.w3.org/2000/svg";

const PATHS = {
  play: "M8 5v14l11-7z",
  pause: "M6 5h4v14H6zM14 5h4v14h-4z",
  next: "M6 5l8 7-8 7V5zm10 0h2v14h-2V5z",
  previous: "M18 5l-8 7 8 7V5zM6 5h2v14H6V5z",
  shuffle:
    "M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.41-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z",
  repeat: "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z",
  "repeat-one": "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-5.5-8.5h-1v3h-3v1h4v-4z",
  "volume-low": "M3 10v4h4l5 5V5L7 10H3zm11.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.26 2.5-4.02z",
  "volume-high":
    "M3 10v4h4l5 5V5L7 10H3zm11.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.26 2.5-4.02zM16.5 4.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
  speaker:
    "M15 20H9V4h6v16zm-6 2h6c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2zm3-3c.83 0 1.5-.67 1.5-1.5S12.83 16 12 16s-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm0-13c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  library:
    "M4 3h2v18H4V3zm5 0h2v18H9V3zm5 .27l1.93-.52 4.66 17.38-1.93.52L14 3.27z",
  settings:
    "M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.63c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  heart:
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  clock:
    "M12 20a8 8 0 100-16 8 8 0 000 16zm0-18a10 10 0 110 20 10 10 0 010-20zm.5 5H11v6l5.25 3.15.75-1.23-4.5-2.67V7z",
  chevronDown: "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  search:
    "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  queue:
    "M3 6h11v2H3V6zm0 5h11v2H3v-2zm0 5h7v2H3v-2zm15-9v6.55a3.5 3.5 0 101.5 2.87V8h3V5h-4.5v2z",
  plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
};

export function icon(name, { size = 20, className = "" } = {}) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  if (className) svg.setAttribute("class", className);

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", PATHS[name] || "");
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);

  return svg;
}

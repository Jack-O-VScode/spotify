// ---------------------------------------------------------------------------
// Small formatting helpers shared across views.
// ---------------------------------------------------------------------------

export function formatDuration(ms) {
  if (typeof ms !== "number" || Number.isNaN(ms) || ms < 0) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Spotify image arrays are sorted largest-first. Picks the smallest image
// that's still >= targetPx (good enough quality without over-fetching a
// thumbnail-sized card), falling back to the largest available.
export function pickImage(images, targetPx = 300) {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (a.width || 0) - (b.width || 0));
  const goodEnough = sorted.find((img) => (img.width || 0) >= targetPx);
  return (goodEnough || sorted[sorted.length - 1]).url;
}

export function joinArtists(artists) {
  return (artists || []).map((a) => a.name).join(", ");
}

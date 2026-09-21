// ---------------------------------------------------------------------------
// Transient, non-blocking status messages (rate limits, offline, "no active
// device", etc). Errors that block a whole view use the view's own error
// state instead — toasts are for things that happen mid-interaction without
// nuking what's already on screen.
// ---------------------------------------------------------------------------

let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement("div");
  container.id = "toast-container";
  document.body.appendChild(container);
  return container;
}

export function showToast(message, { duration = 4000, variant = "default" } = {}) {
  const el = ensureContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${variant}`;
  toast.textContent = message;
  el.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

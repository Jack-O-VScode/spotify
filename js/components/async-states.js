// ---------------------------------------------------------------------------
// Shared loading / error / empty placeholders so every view handles a failed
// fetch the same visible way instead of silently showing a blank screen.
// ---------------------------------------------------------------------------

import { el, clear } from "../dom.js";
import { RateLimitedError, OfflineError, ApiError } from "../api.js";

export function renderLoading(container, message = "Loading…") {
  clear(container);
  container.appendChild(el("div", { class: "state-message", text: message }));
}

export function renderEmpty(container, message) {
  clear(container);
  container.appendChild(el("div", { class: "state-message", text: message }));
}

export function renderError(container, err, onRetry) {
  clear(container);
  const message = describeError(err);
  const box = el("div", { class: "state-error" }, [
    el("p", { text: message }),
    onRetry ? el("button", { class: "btn-secondary", type: "button", text: "Retry", onclick: onRetry }) : null,
  ]);
  container.appendChild(box);
}

export function describeError(err) {
  if (err instanceof RateLimitedError) {
    return `Spotify is rate-limiting us. Try again in ${err.retryAfterSeconds}s.`;
  }
  if (err instanceof OfflineError) return err.message;
  if (err instanceof ApiError) return err.message;
  return `Something went wrong: ${err.message}`;
}

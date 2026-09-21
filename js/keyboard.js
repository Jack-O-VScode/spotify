// ---------------------------------------------------------------------------
// Keyboard shortcuts, for when this is open on a laptop rather than a phone.
// Every handler bails while focus is in a text field, so typing a hex colour
// or a search query never doubles as a transport command.
// ---------------------------------------------------------------------------

import { store } from "./state.js";
import { resume, pause, next, previous } from "./player.js";
import { navigate } from "./router.js";

function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function initKeyboardShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;

    switch (event.key) {
      case " ":
        // Space would otherwise scroll the page.
        event.preventDefault();
        if (store.playback?.is_playing) pause();
        else resume();
        break;
      case "ArrowRight":
        event.preventDefault();
        next();
        break;
      case "ArrowLeft":
        event.preventDefault();
        previous();
        break;
      case "/":
        event.preventDefault();
        navigate("#/search");
        break;
      default:
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// Drag the grab handle downwards to close a bottom sheet, the way iOS sheets
// behave.
//
// Bound to the handle only, not the whole panel: .sheet-content scrolls, and
// claiming vertical drags anywhere on it would fight the track list for the
// same gesture.
// ---------------------------------------------------------------------------

const CLOSE_DISTANCE_PX = 90;
const CLOSE_VELOCITY = 0.5; // px per ms

export function enableSwipeToDismiss(handleEl, contentEl, onClose) {
  let startY = 0;
  let startTime = 0;
  let offset = 0;
  let dragging = false;

  function setOffset(value) {
    contentEl.style.transform = value ? `translateY(${value}px)` : "";
  }

  function end(commitClose) {
    if (!dragging) return;
    dragging = false;
    contentEl.style.transition = "";

    if (commitClose) {
      // Hand back to the stylesheet's own hidden transform so the closing
      // animation matches every other dismissal.
      setOffset(0);
      onClose();
    } else {
      setOffset(0);
    }
  }

  handleEl.addEventListener("pointerdown", (event) => {
    dragging = true;
    startY = event.clientY;
    startTime = performance.now();
    offset = 0;
    contentEl.style.transition = "none";
    handleEl.setPointerCapture?.(event.pointerId);
  });

  handleEl.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    // Downwards only — dragging up shouldn't lift the sheet off its anchor.
    offset = Math.max(0, event.clientY - startY);
    setOffset(offset);
  });

  handleEl.addEventListener("pointerup", (event) => {
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = offset / elapsed;
    handleEl.releasePointerCapture?.(event.pointerId);
    end(offset > CLOSE_DISTANCE_PX || velocity > CLOSE_VELOCITY);
  });

  handleEl.addEventListener("pointercancel", () => end(false));
}

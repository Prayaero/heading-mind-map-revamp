export const PAN_START_DISTANCE = 4;

export function exceedsPanThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= PAN_START_DISTANCE;
}

/** Lets the user drag the canvas with the left mouse button (or touch/pen) to scroll the mind map. */
export function enableCanvasPan(canvas: HTMLElement, shouldIgnore: (target: HTMLElement) => boolean = () => false): void {
  canvas.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const target = event.target as HTMLElement;
    if (target.closest("textarea, input") || shouldIgnore(target)) return;
    const rect = canvas.getBoundingClientRect();
    // Ignore presses on the scrollbars.
    if (event.clientX - rect.left >= canvas.clientWidth || event.clientY - rect.top >= canvas.clientHeight) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = canvas.scrollLeft;
    const startTop = canvas.scrollTop;
    let panning = false;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!panning) {
        if (!exceedsPanThreshold(dx, dy)) return;
        panning = true;
        canvas.setPointerCapture(event.pointerId);
        canvas.addClass("is-panning");
      }
      canvas.scrollLeft = startLeft - dx;
      canvas.scrollTop = startTop - dy;
    };
    const onEnd = () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onEnd);
      canvas.removeEventListener("pointercancel", onEnd);
      if (!panning) return;
      canvas.removeClass("is-panning");
      // A drag must not also count as a click that selects a node.
      const swallowClick = (clickEvent: MouseEvent) => clickEvent.stopPropagation();
      canvas.addEventListener("click", swallowClick, { capture: true, once: true });
      window.setTimeout(() => canvas.removeEventListener("click", swallowClick, { capture: true }), 0);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onEnd);
    canvas.addEventListener("pointercancel", onEnd);
  });
}

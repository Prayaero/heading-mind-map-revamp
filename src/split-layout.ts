export const DEFAULT_BODY_WIDTH_RATIO = 0.45;
export const MIN_BODY_WIDTH_RATIO = 0.15;
export const MAX_BODY_WIDTH_RATIO = 0.85;
export const KEYBOARD_RESIZE_STEP = 0.03;

export function normalizeBodyWidthRatio(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_BODY_WIDTH_RATIO;
  return Math.min(MAX_BODY_WIDTH_RATIO, Math.max(MIN_BODY_WIDTH_RATIO, value));
}

/** Width share of the note pane when the divider sits at `pointerX` inside a split spanning `left`..`left + width`. */
export function ratioFromPointer(pointerX: number, left: number, width: number): number {
  if (width <= 0) return DEFAULT_BODY_WIDTH_RATIO;
  return normalizeBodyWidthRatio(1 - (pointerX - left) / width);
}

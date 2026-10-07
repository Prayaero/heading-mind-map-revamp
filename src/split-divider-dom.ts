import {
  KEYBOARD_RESIZE_STEP,
  MAX_BODY_WIDTH_RATIO,
  MIN_BODY_WIDTH_RATIO,
  normalizeBodyWidthRatio,
  ratioFromPointer
} from "./split-layout";

export type SplitDividerOptions = {
  splitEl: HTMLElement;
  getRatio: () => number;
  onRatioChange: (ratio: number) => void;
  onRatioCommit: (ratio: number) => void;
};

export function applyBodyWidthRatio(bodyEl: HTMLElement, dividerEl: HTMLElement | undefined, ratio: number): void {
  const normalized = normalizeBodyWidthRatio(ratio);
  bodyEl.style.setProperty("--hmr-body-width", `${(normalized * 100).toFixed(2)}%`);
  dividerEl?.setAttr("aria-valuenow", String(Math.round(normalized * 100)));
}

export function renderSplitDivider(parent: HTMLElement, options: SplitDividerOptions): HTMLElement {
  const divider = parent.createDiv({
    cls: "hmr-divider",
    attr: {
      role: "separator",
      "aria-orientation": "vertical",
      "aria-label": "Resize note pane",
      "aria-valuemin": String(Math.round(MIN_BODY_WIDTH_RATIO * 100)),
      "aria-valuemax": String(Math.round(MAX_BODY_WIDTH_RATIO * 100)),
      tabindex: "0"
    }
  });

  divider.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    divider.setPointerCapture(event.pointerId);
    divider.addClass("is-dragging");
    options.splitEl.addClass("is-resizing");

    const bounds = options.splitEl.getBoundingClientRect();
    let ratio = options.getRatio();
    const onMove = (moveEvent: PointerEvent) => {
      ratio = ratioFromPointer(moveEvent.clientX, bounds.left, bounds.width);
      options.onRatioChange(ratio);
    };
    const onEnd = () => {
      divider.removeEventListener("pointermove", onMove);
      divider.removeEventListener("pointerup", onEnd);
      divider.removeEventListener("pointercancel", onEnd);
      divider.removeClass("is-dragging");
      options.splitEl.removeClass("is-resizing");
      options.onRatioCommit(ratio);
    };
    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onEnd);
    divider.addEventListener("pointercancel", onEnd);
  });

  divider.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    // Moving the divider left gives the note pane more room.
    const delta = event.key === "ArrowLeft" ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP;
    const ratio = normalizeBodyWidthRatio(options.getRatio() + delta);
    options.onRatioChange(ratio);
    options.onRatioCommit(ratio);
  });

  divider.addEventListener("dblclick", () => {
    const ratio = normalizeBodyWidthRatio(undefined);
    options.onRatioChange(ratio);
    options.onRatioCommit(ratio);
  });

  return divider;
}

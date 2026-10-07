import { findDropTarget, getSlotLine, type NodeRect } from "./drop-target";
import type { MovePosition } from "./mindmap-operations";

export const DRAG_START_DISTANCE = 5;
const EDGE_SCROLL_ZONE = 36;
const EDGE_SCROLL_SPEED = 14;

export function getEdgeScrollDelta(pointer: number, start: number, end: number): number {
  if (pointer < start + EDGE_SCROLL_ZONE) return -EDGE_SCROLL_SPEED * Math.min(1, (start + EDGE_SCROLL_ZONE - pointer) / EDGE_SCROLL_ZONE);
  if (pointer > end - EDGE_SCROLL_ZONE) return EDGE_SCROLL_SPEED * Math.min(1, (pointer - (end - EDGE_SCROLL_ZONE)) / EDGE_SCROLL_ZONE);
  return 0;
}

export interface NodeDragOptions {
  canvas: HTMLElement;
  getScale: () => number;
  /** Whether this node may be picked up at all. */
  canDrag: (nodeId: string) => boolean;
  /** Whether dropping here is allowed (used for hover feedback). */
  canDrop: (nodeId: string, targetId: string, position: MovePosition) => boolean;
  onDrop: (nodeId: string, targetId: string, position: MovePosition) => void;
}

const DROP_CLASSES = ["is-drop-child", "is-drop-invalid"];

export function enableNodeDrag(options: NodeDragOptions): void {
  const { canvas } = options;
  // Stop the browser from starting a native text/element drag, which would cancel our pointer events.
  canvas.addEventListener("dragstart", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const nodeEl = (event.target as HTMLElement).closest<HTMLElement>(".hmr-node");
    if (!nodeEl || (event.target as HTMLElement).closest("textarea, input")) return;
    const nodeId = nodeEl.dataset.nodeId;
    if (!nodeId || !options.canDrag(nodeId)) return;
    new NodeDragSession(options, nodeEl, nodeId, event).begin();
  });
}

class NodeDragSession {
  private ghost?: HTMLElement;
  private line?: HTMLElement;
  private dragging = false;
  private target: { el: HTMLElement; id: string; position: MovePosition } | null = null;
  private pointer: { x: number; y: number };
  private frame = 0;
  private readonly offset: { x: number; y: number };
  private readonly abort = new AbortController();

  constructor(
    private readonly options: NodeDragOptions,
    private readonly nodeEl: HTMLElement,
    private readonly nodeId: string,
    private readonly startEvent: PointerEvent
  ) {
    const rect = nodeEl.getBoundingClientRect();
    this.pointer = { x: startEvent.clientX, y: startEvent.clientY };
    this.offset = { x: startEvent.clientX - rect.left, y: startEvent.clientY - rect.top };
  }

  begin(): void {
    const { signal } = this.abort;
    const canvas = this.options.canvas;
    canvas.addEventListener("pointermove", (event) => this.onMove(event), { signal });
    canvas.addEventListener("pointerup", () => this.finish(true), { signal });
    canvas.addEventListener("pointercancel", () => this.finish(false), { signal });
    canvas.ownerDocument.addEventListener("keydown", (event) => event.key === "Escape" && this.finish(false), { signal });
  }

  private onMove(event: PointerEvent): void {
    this.pointer = { x: event.clientX, y: event.clientY };
    if (!this.dragging) {
      if (Math.hypot(this.pointer.x - this.startEvent.clientX, this.pointer.y - this.startEvent.clientY) < DRAG_START_DISTANCE) return;
      this.startDragging();
    }
    this.updateGhost();
    this.updateTarget();
  }

  private startDragging(): void {
    this.dragging = true;
    const canvas = this.options.canvas;
    canvas.setPointerCapture(this.startEvent.pointerId);
    canvas.addClass("is-node-dragging");
    this.nodeEl.addClass("is-dragging");
    const rect = this.nodeEl.getBoundingClientRect();
    const ghost = this.nodeEl.cloneNode(true) as HTMLElement;
    ghost.addClass("hmr-drag-ghost");
    ghost.style.width = `${rect.width / this.options.getScale()}px`;
    ghost.style.height = `${rect.height / this.options.getScale()}px`;
    ghost.style.transform = `scale(${this.options.getScale()})`;
    canvas.ownerDocument.body.appendChild(ghost);
    this.ghost = ghost;
    this.line = canvas.ownerDocument.body.createDiv({ cls: "hmr-drop-line" });
    this.frame = window.requestAnimationFrame(() => this.autoScroll());
  }

  private updateGhost(): void {
    if (!this.ghost) return;
    this.ghost.style.left = `${this.pointer.x - this.offset.x}px`;
    this.ghost.style.top = `${this.pointer.y - this.offset.y}px`;
  }

  private updateTarget(): void {
    this.clearTarget();
    const canvasRect = this.options.canvas.getBoundingClientRect();
    const { x, y } = this.pointer;
    if (x < canvasRect.left || x > canvasRect.right || y < canvasRect.top || y > canvasRect.bottom) return;

    const elements = Array.from(this.options.canvas.querySelectorAll<HTMLElement>(".hmr-node"));
    const rects: NodeRect[] = elements.flatMap((el) => {
      const id = el.dataset.nodeId;
      if (!id) return [];
      const r = el.getBoundingClientRect();
      return [{ id, left: r.left, top: r.top, right: r.right, bottom: r.bottom }];
    });
    const found = findDropTarget(rects, x, y, this.nodeId);
    if (!found) return;
    const el = elements.find((candidate) => candidate.dataset.nodeId === found.id);
    if (!el) return;

    this.target = { el, id: found.id, position: found.position };
    const valid = this.options.canDrop(this.nodeId, found.id, found.position);
    if (found.position === "child") {
      el.addClass(valid ? "is-drop-child" : "is-drop-invalid");
      return;
    }
    const slot = getSlotLine(rects, found);
    if (!slot || !this.line) return;
    this.line.style.left = `${slot.left}px`;
    this.line.style.width = `${slot.right - slot.left}px`;
    this.line.style.top = `${slot.y}px`;
    this.line.toggleClass("is-invalid", !valid);
    this.line.addClass("is-visible");
  }

  private clearTarget(): void {
    this.target?.el.removeClasses(DROP_CLASSES);
    this.line?.removeClass("is-visible");
    this.target = null;
  }

  private autoScroll(): void {
    const canvas = this.options.canvas;
    const rect = canvas.getBoundingClientRect();
    const dx = getEdgeScrollDelta(this.pointer.x, rect.left, rect.right);
    const dy = getEdgeScrollDelta(this.pointer.y, rect.top, rect.bottom);
    if (dx || dy) {
      canvas.scrollLeft += dx;
      canvas.scrollTop += dy;
      this.updateTarget();
    }
    this.frame = window.requestAnimationFrame(() => this.autoScroll());
  }

  private finish(drop: boolean): void {
    this.abort.abort();
    window.cancelAnimationFrame(this.frame);
    if (!this.dragging) return;
    const target = this.target;
    this.clearTarget();
    this.ghost?.remove();
    this.line?.remove();
    this.nodeEl.removeClass("is-dragging");
    this.options.canvas.removeClass("is-node-dragging");
    // A drag must not also count as a click that selects a node.
    const canvas = this.options.canvas;
    const swallowClick = (clickEvent: MouseEvent) => clickEvent.stopPropagation();
    canvas.addEventListener("click", swallowClick, { capture: true, once: true });
    window.setTimeout(() => canvas.removeEventListener("click", swallowClick, { capture: true }), 0);
    if (drop && target && this.options.canDrop(this.nodeId, target.id, target.position)) {
      this.options.onDrop(this.nodeId, target.id, target.position);
    }
  }
}

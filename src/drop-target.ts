import type { MovePosition } from "./mindmap-operations";

export type NodeRect = { id: string; left: number; top: number; right: number; bottom: number };

export type DropTarget = { id: string; position: MovePosition };

/** How far (px) from a column of nodes the pointer may be and still pick a slot in that column. */
const COLUMN_REACH = 90;
/** How far (px) above the first / below the last node of a column a slot can still be picked. */
const END_REACH = 70;

/**
 * Over a node, the upper half means "before it" and the lower half "after it", so reordering works anywhere on a
 * node, however small it is zoomed out. Making it a child is a deliberate gesture: the right half of the node's
 * middle band.
 */
export function getDropPosition(pointerX: number, pointerY: number, rect: NodeRect): MovePosition {
  const height = rect.bottom - rect.top;
  const width = rect.right - rect.left;
  if (height <= 0 || width <= 0) return "child";
  const ratioY = (pointerY - rect.top) / height;
  const ratioX = (pointerX - rect.left) / width;
  if (ratioY >= 0.3 && ratioY <= 0.7 && ratioX >= 0.5) return "child";
  return ratioY < 0.5 ? "before" : "after";
}

/**
 * Works out where a dragged node would land. Over a node it uses the node's top/middle/bottom zones; in the empty
 * space between (or above/below) the nodes of a column it picks the nearest slot, so the gap itself is a drop target.
 */
export function findDropTarget(rects: NodeRect[], x: number, y: number, draggedId: string): DropTarget | null {
  const over = rects.find((rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  if (over) {
    if (over.id === draggedId) return null;
    return { id: over.id, position: getDropPosition(x, y, over) };
  }
  const column = pickColumn(rects, x);
  return column ? pickSlot(column, y) : null;
}

/** Where to draw the insertion line for a before/after drop: centered in the gap to the neighboring node. */
export function getSlotLine(rects: NodeRect[], target: DropTarget): { y: number; left: number; right: number } | null {
  const node = rects.find((rect) => rect.id === target.id);
  if (!node || target.position === "child") return null;
  const column = pickColumn(rects, (node.left + node.right) / 2) ?? [node];
  const index = column.findIndex((rect) => rect.id === target.id);
  const neighbor = column[index + (target.position === "before" ? -1 : 1)];
  const edge = target.position === "before" ? node.top : node.bottom;
  const neighborEdge = neighbor ? (target.position === "before" ? neighbor.bottom : neighbor.top) : null;
  const fallback = target.position === "before" ? -12 : 12;
  return { y: neighborEdge === null ? edge + fallback : (edge + neighborEdge) / 2, left: node.left, right: node.right };
}

/** Nodes of the same depth share a left edge; the column closest to the pointer (horizontally) wins. */
function pickColumn(rects: NodeRect[], x: number): NodeRect[] | null {
  const columns = new Map<number, NodeRect[]>();
  for (const rect of rects) {
    const key = Math.round(rect.left / 4);
    columns.set(key, [...(columns.get(key) ?? []), rect]);
  }
  let best: { nodes: NodeRect[]; distance: number } | null = null;
  for (const nodes of columns.values()) {
    const left = Math.min(...nodes.map((node) => node.left));
    const right = Math.max(...nodes.map((node) => node.right));
    const distance = x < left ? left - x : x > right ? x - right : 0;
    if (distance <= COLUMN_REACH && (!best || distance < best.distance)) best = { nodes, distance };
  }
  return best ? [...best.nodes].sort((a, b) => a.top - b.top) : null;
}

function pickSlot(column: NodeRect[], y: number): DropTarget | null {
  const first = column[0];
  const last = column[column.length - 1];
  if (y < first.top) return first.top - y <= END_REACH ? { id: first.id, position: "before" } : null;
  if (y > last.bottom) return y - last.bottom <= END_REACH ? { id: last.id, position: "after" } : null;
  for (let index = 0; index < column.length - 1; index += 1) {
    const upper = column[index];
    const lower = column[index + 1];
    if (y >= upper.bottom && y <= lower.top) {
      return y < (upper.bottom + lower.top) / 2 ? { id: upper.id, position: "after" } : { id: lower.id, position: "before" };
    }
  }
  return null;
}

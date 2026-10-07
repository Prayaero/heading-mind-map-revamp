import { describe, expect, it } from "vitest";
import { findDropTarget, getDropPosition, getSlotLine, type NodeRect } from "../src/drop-target";

// A parent in column one and three siblings (a, b, c) in column two, 60px tall with 40px gaps.
const parent: NodeRect = { id: "p", left: 0, top: 100, right: 200, bottom: 160 };
const a: NodeRect = { id: "a", left: 320, top: 0, right: 520, bottom: 60 };
const b: NodeRect = { id: "b", left: 320, top: 100, right: 520, bottom: 160 };
const c: NodeRect = { id: "c", left: 320, top: 200, right: 520, bottom: 260 };
const rects = [parent, a, b, c];

describe("drop zones over a node", () => {
  it("uses the upper half for before and the lower half for after, wherever on the node the pointer is", () => {
    expect(getDropPosition(330, 105, b)).toBe("before");
    expect(getDropPosition(500, 110, b)).toBe("before");
    expect(getDropPosition(330, 140, b)).toBe("after");
    expect(getDropPosition(500, 155, b)).toBe("after");
  });

  it("makes the right half of the middle band the child zone", () => {
    expect(getDropPosition(450, 130, b)).toBe("child");
    expect(getDropPosition(330, 128, b)).toBe("before");
    expect(getDropPosition(450, 116, b)).toBe("before");
    expect(getDropPosition(450, 146, b)).toBe("after");
  });

  it("stays usable on very small nodes, such as zoomed-out H3 headings", () => {
    const small: NodeRect = { id: "s", left: 0, top: 100, right: 80, bottom: 123 };
    expect(getDropPosition(20, 105, small)).toBe("before");
    expect(getDropPosition(20, 118, small)).toBe("after");
  });

  it("uses those zones for the node under the pointer", () => {
    expect(findDropTarget(rects, 400, 110, "x")).toEqual({ id: "b", position: "before" });
    expect(findDropTarget(rects, 480, 130, "x")).toEqual({ id: "b", position: "child" });
    expect(findDropTarget(rects, 400, 150, "x")).toEqual({ id: "b", position: "after" });
  });

  it("gives no target over the dragged node itself", () => {
    expect(findDropTarget(rects, 400, 130, "b")).toBeNull();
  });
});

describe("drop in the empty space between nodes", () => {
  it("drops into the gap between two siblings, choosing the nearer neighbor", () => {
    expect(findDropTarget(rects, 400, 75, "x")).toEqual({ id: "a", position: "after" });
    expect(findDropTarget(rects, 400, 85, "x")).toEqual({ id: "b", position: "before" });
    expect(findDropTarget(rects, 400, 175, "x")).toEqual({ id: "b", position: "after" });
    expect(findDropTarget(rects, 400, 190, "x")).toEqual({ id: "c", position: "before" });
  });

  it("works anywhere across the width of the column and slightly beside it", () => {
    expect(findDropTarget(rects, 330, 85, "x")).toEqual({ id: "b", position: "before" });
    expect(findDropTarget(rects, 600, 85, "x")).toEqual({ id: "b", position: "before" });
  });

  it("drops above the first and below the last node when the pointer is close enough", () => {
    expect(findDropTarget(rects, 400, -30, "x")).toEqual({ id: "a", position: "before" });
    expect(findDropTarget(rects, 400, 300, "x")).toEqual({ id: "c", position: "after" });
    expect(findDropTarget(rects, 400, 600, "x")).toBeNull();
  });

  it("picks the column nearest to the pointer, and nothing when the pointer is far from every column", () => {
    expect(findDropTarget(rects, 230, 175, "x")).toEqual({ id: "p", position: "after" });
    expect(findDropTarget(rects, 290, 175, "x")).toEqual({ id: "b", position: "after" });
    expect(findDropTarget(rects, 1500, 85, "x")).toBeNull();
  });
});

describe("insertion line", () => {
  it("is centered in the gap to the neighbor", () => {
    expect(getSlotLine(rects, { id: "b", position: "before" })).toEqual({ y: 80, left: 320, right: 520 });
    expect(getSlotLine(rects, { id: "b", position: "after" })).toEqual({ y: 180, left: 320, right: 520 });
  });

  it("sits just outside the first and last node, and is not drawn for child drops", () => {
    expect(getSlotLine(rects, { id: "a", position: "before" })?.y).toBe(-12);
    expect(getSlotLine(rects, { id: "c", position: "after" })?.y).toBe(272);
    expect(getSlotLine(rects, { id: "b", position: "child" })).toBeNull();
  });
});

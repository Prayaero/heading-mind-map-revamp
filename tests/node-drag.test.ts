import { describe, expect, it } from "vitest";
import { getEdgeScrollDelta } from "../src/node-drag";

describe("node drag helpers", () => {
  it("scrolls toward an edge only when the pointer is close to it", () => {
    expect(getEdgeScrollDelta(500, 0, 1000)).toBe(0);
    expect(getEdgeScrollDelta(5, 0, 1000)).toBeLessThan(0);
    expect(getEdgeScrollDelta(995, 0, 1000)).toBeGreaterThan(0);
    expect(getEdgeScrollDelta(0, 0, 1000)).toBeLessThan(getEdgeScrollDelta(30, 0, 1000));
  });
});

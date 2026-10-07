import { describe, expect, it } from "vitest";
import { PAN_START_DISTANCE, exceedsPanThreshold } from "../src/canvas-pan";

describe("canvas pan", () => {
  it("treats small pointer movement as a click, not a drag", () => {
    expect(exceedsPanThreshold(0, 0)).toBe(false);
    expect(exceedsPanThreshold(PAN_START_DISTANCE - 1, 0)).toBe(false);
    expect(exceedsPanThreshold(2, 2)).toBe(false);
  });

  it("starts panning once the pointer has moved far enough in any direction", () => {
    expect(exceedsPanThreshold(PAN_START_DISTANCE, 0)).toBe(true);
    expect(exceedsPanThreshold(0, -PAN_START_DISTANCE)).toBe(true);
    expect(exceedsPanThreshold(3, 3)).toBe(true);
  });
});

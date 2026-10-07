import { describe, expect, it } from "vitest";
import {
  DEFAULT_BODY_WIDTH_RATIO,
  MAX_BODY_WIDTH_RATIO,
  MIN_BODY_WIDTH_RATIO,
  normalizeBodyWidthRatio,
  ratioFromPointer
} from "../src/split-layout";

describe("split layout", () => {
  it("falls back to the default ratio for missing or invalid values", () => {
    expect(normalizeBodyWidthRatio(undefined)).toBe(DEFAULT_BODY_WIDTH_RATIO);
    expect(normalizeBodyWidthRatio("0.5")).toBe(DEFAULT_BODY_WIDTH_RATIO);
    expect(normalizeBodyWidthRatio(Number.NaN)).toBe(DEFAULT_BODY_WIDTH_RATIO);
    expect(normalizeBodyWidthRatio(Number.POSITIVE_INFINITY)).toBe(DEFAULT_BODY_WIDTH_RATIO);
  });

  it("clamps the ratio so neither pane can disappear", () => {
    expect(normalizeBodyWidthRatio(0)).toBe(MIN_BODY_WIDTH_RATIO);
    expect(normalizeBodyWidthRatio(1)).toBe(MAX_BODY_WIDTH_RATIO);
    expect(normalizeBodyWidthRatio(0.6)).toBe(0.6);
  });

  it("derives the note pane share from the divider position", () => {
    expect(ratioFromPointer(600, 0, 1000)).toBeCloseTo(0.4);
    expect(ratioFromPointer(700, 100, 1000)).toBeCloseTo(0.4);
  });

  it("clamps drags beyond either edge and tolerates a zero-width container", () => {
    expect(ratioFromPointer(-50, 0, 1000)).toBe(MAX_BODY_WIDTH_RATIO);
    expect(ratioFromPointer(5000, 0, 1000)).toBe(MIN_BODY_WIDTH_RATIO);
    expect(ratioFromPointer(10, 0, 0)).toBe(DEFAULT_BODY_WIDTH_RATIO);
  });
});

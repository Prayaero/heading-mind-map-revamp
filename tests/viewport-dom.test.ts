import { describe, expect, it } from "vitest";
import {
  getFitViewportState,
  getSurfacePointViewportCenter,
  getStableScrollAreaSize,
  getSurfacePlacement,
  getZoomedViewportState,
  preserveViewportForClose,
  preserveViewportForRender,
  restoreViewportScroll
} from "../src/viewport-dom";

describe("restoreViewportScroll", () => {
  it("restores the mind map scroll position synchronously so it doesn't jump to the top after a re-render", () => {
    const scrollTarget = { scrollLeft: 0, scrollTop: 0 };

    restoreViewportScroll(scrollTarget, { scrollLeft: 120, scrollTop: 340 });

    expect(scrollTarget).toEqual({ scrollLeft: 120, scrollTop: 340 });
  });

  it("re-rendering uses the viewport captured when the operation started, so scroll values aren't reset during an async save", () => {
    expect(
      preserveViewportForRender(
        { scale: 1, scrollLeft: 0, scrollTop: 0 },
        { scale: 1, scrollLeft: 120, scrollTop: 40 }
      )
    ).toEqual({ scale: 1, scrollLeft: 120, scrollTop: 40 });
  });

  it("keeps enough scroll area after the layout shrinks so the browser doesn't clamp scrollLeft back to 0", () => {
    expect(getStableScrollAreaSize(700, 120, 900)).toBe(1020);
    expect(getStableScrollAreaSize(1200, 120, 900)).toBe(1200);
  });

  it("fit-to-view scales to the current canvas size and centers a small map on a narrow mobile canvas", () => {
    const viewport = getFitViewportState({ width: 1200, height: 800 }, { width: 360, height: 640 });
    const placement = getSurfacePlacement({ width: 1200, height: 800 }, { width: 360, height: 640 }, viewport);

    expect(viewport.scale).toBeCloseTo(0.26);
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
    expect(placement.offsetLeft).toBeCloseTo(24);
    expect(placement.offsetTop).toBeCloseTo(216);
  });

  it("zooming keeps the current viewport center so it doesn't jump to the top-left", () => {
    expect(
      getZoomedViewportState(
        { scale: 1, scrollLeft: 100, scrollTop: 80 },
        2,
        { width: 300, height: 200 }
      )
    ).toEqual({
      scale: 2,
      scrollLeft: 350,
      scrollTop: 260
    });
  });

  it("converts a node's center to visible canvas coordinates so toolbar zoom keeps the focused node in place", () => {
    expect(
      getSurfacePointViewportCenter({
        point: { x: 300, y: 120 },
        surfaceOffset: { x: 40, y: 20 },
        viewport: { scale: 1.5, scrollLeft: 220, scrollTop: 100 }
      })
    ).toEqual({ x: 270, y: 100 });
  });

  it("zooming still keeps the given node in place when a small centered map grows into a scrollable size", () => {
    const contentSize = { width: 200, height: 200 };
    const viewportSize = { width: 600, height: 400 };
    const currentViewport = { scale: 1, scrollLeft: 0, scrollTop: 0 };
    const nodeCenter = getSurfacePointViewportCenter({
      point: { x: 180, y: 150 },
      surfaceOffset: { x: 200, y: 100 },
      viewport: currentViewport
    });
    const zoomedViewport = getZoomedViewportState(currentViewport, 4, viewportSize, nodeCenter, contentSize);
    const zoomedPlacement = getSurfacePlacement(contentSize, viewportSize, zoomedViewport);

    expect(zoomedViewport).toEqual({ scale: 2, scrollLeft: 80, scrollTop: 50 });
    expect(zoomedPlacement.offsetLeft).toBe(100);
    expect(zoomedPlacement.offsetTop).toBe(0);
    expect(
      getSurfacePointViewportCenter({
        point: { x: 180, y: 150 },
        surfaceOffset: { x: zoomedPlacement.offsetLeft, y: zoomedPlacement.offsetTop },
        viewport: zoomedViewport
      })
    ).toEqual(nodeCenter);
  });

  it("closing the view doesn't let the zero scroll from teardown overwrite the known viewport", () => {
    expect(
      preserveViewportForClose(
        { scale: 1, scrollLeft: 120, scrollTop: 40 },
        { scale: 1, scrollLeft: 0, scrollTop: 0 }
      )
    ).toEqual({ scale: 1, scrollLeft: 120, scrollTop: 40 });

    expect(
      preserveViewportForClose(
        { scale: 1, scrollLeft: 120, scrollTop: 0 },
        { scale: 1, scrollLeft: 0, scrollTop: 0 }
      )
    ).toEqual({ scale: 1, scrollLeft: 120, scrollTop: 0 });

    expect(
      preserveViewportForClose(
        { scale: 1, scrollLeft: 120, scrollTop: 40 },
        { scale: 1, scrollLeft: 20, scrollTop: 0 }
      )
    ).toEqual({ scale: 1, scrollLeft: 20, scrollTop: 0 });
  });
});

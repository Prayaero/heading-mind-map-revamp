import { describe, expect, it } from "vitest";
import { parseMindmapMarkdown } from "../src/mindmap-model";
import {
  applyStoredMindmapState,
  collectStoredMindmapState,
  getNodeIdByKey,
  getNodeKey,
  getStoredViewportState,
  normalizeViewportState,
  resolveInitialViewportState
} from "../src/mindmap-view-state";

describe("mindmap view state", () => {
  it("saves and restores node collapse, file outline expansion and the mind map viewport", () => {
    const root = parseMindmapMarkdown("projects/map.md", "# Product\n\n## Goal\n\n## [[notes/project.md|Project]]");
    root.children[0].children[0].childrenCollapsed = true;
    root.children[0].children[1].outlineExpanded = true;

    const stored = collectStoredMindmapState(root, { scale: 3, scrollLeft: 120, scrollTop: 340 });
    const reopened = parseMindmapMarkdown("projects/map.md", "# Product\n\n## Goal\n\n## [[notes/project.md|Project]]");
    applyStoredMindmapState(reopened, stored);

    expect(reopened.children[0].children[0].childrenCollapsed).toBe(true);
    expect(reopened.children[0].children[1].outlineExpanded).toBe(true);
    expect(getStoredViewportState(stored)).toEqual({ scale: 2, scrollLeft: 120, scrollTop: 340 });
  });

  it("prefers the leaf's own viewport and filters out invalid values", () => {
    const stored = { collapsedNodeKeys: [], expandedFileNodeKeys: [], viewport: { scale: 1.4, scrollLeft: 120, scrollTop: 340 } };
    expect(resolveInitialViewportState(undefined, stored)).toEqual(stored.viewport);
    expect(resolveInitialViewportState({ scale: 0.8, scrollLeft: 10, scrollTop: 20 }, stored)).toEqual({
      scale: 0.8,
      scrollLeft: 10,
      scrollTop: 20
    });
    expect(normalizeViewportState({ scale: 0.05, scrollLeft: -1, scrollTop: Number.NaN })).toEqual({
      scale: 0.1,
      scrollLeft: 0,
      scrollTop: 0
    });
  });

  it("restores the selected node after re-parsing using stable structure keys", () => {
    const root = parseMindmapMarkdown("projects/map.md", "# Product\n\n## Goal\n\n## Goal\n\n### Subgoal");
    const key = getNodeKey(root, root.children[0].children[1].children[0].id);
    const reopened = parseMindmapMarkdown("projects/map.md", "# Product\n\n## Goal\n\n## Goal\n\n### Subgoal");
    expect(getNodeIdByKey(reopened, key ?? undefined)).toBe(reopened.children[0].children[1].children[0].id);
  });
});

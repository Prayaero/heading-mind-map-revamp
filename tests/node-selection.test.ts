import { describe, expect, it } from "vitest";
import { createTextNode } from "../src/mindmap-model";
import {
  getSelectionAfterReload,
  getSelectionAfterSubtreeRemoval,
  getSelectionUpdate,
  shouldChangeSelectedNode
} from "../src/node-selection";

describe("node selection", () => {
  it("re-selecting the current node doesn't trigger a view update", () => {
    expect(shouldChangeSelectedNode("node-a", "node-a")).toBe(false);
  });

  it("selecting a different node triggers a view update", () => {
    expect(shouldChangeSelectedNode("node-a", "node-b")).toBe(true);
  });

  it("arrow keys stopping at a boundary don't trigger a view update", () => {
    expect(getSelectionUpdate("node-a", "node-a")).toEqual({
      changed: false,
      selectedNodeId: "node-a"
    });
  });

  it("arrow keys moving to a different node trigger a view update", () => {
    expect(getSelectionUpdate("node-a", "node-b")).toEqual({
      changed: true,
      selectedNodeId: "node-b"
    });
  });

  it("falls back to the node that triggered the removal when the selected node is removed", () => {
    const root = {
      ...createTextNode("root"),
      id: "root",
      children: [{ ...createTextNode("File node"), id: "file", children: [] }]
    };

    expect(getSelectionAfterSubtreeRemoval(root, "external", "file")).toBe("file");
    expect(getSelectionAfterSubtreeRemoval(root, "file", "root")).toBe("file");
  });

  it("after reloading, read-only preview nodes are not kept as shortcut targets", () => {
    const root = {
      ...createTextNode("root"),
      id: "root",
      children: [
        { ...createTextNode("Goal"), id: "target", children: [] },
        {
          ...createTextNode("File node"),
          id: "file",
          type: "file" as const,
          outlineExpanded: true,
          children: [{ ...createTextNode("External section"), id: "external", children: [] }]
        }
      ]
    };

    expect(getSelectionAfterReload(root, "external", undefined, true)).toBe("root");
    expect(getSelectionAfterReload(root, "target", undefined, true)).toBe("target");
    expect(getSelectionAfterReload(root, "missing", "target", true)).toBe("target");
    expect(getSelectionAfterReload(root, "missing", "external", true)).toBe("root");
    expect(getSelectionAfterReload(root, "target", undefined, false)).toBe("root");
  });
});

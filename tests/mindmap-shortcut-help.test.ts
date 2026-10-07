import { describe, expect, it } from "vitest";
import { MINDMAP_SHORTCUT_HELP } from "../src/mindmap-shortcut-help";

describe("mindmap shortcut help", () => {
  it("covers the mind map shortcuts and keeps key descriptions unique", () => {
    expect(MINDMAP_SHORTCUT_HELP.length).toBeGreaterThanOrEqual(10);
    expect(new Set(MINDMAP_SHORTCUT_HELP.map((item) => item.keys)).size).toBe(MINDMAP_SHORTCUT_HELP.length);
    expect(MINDMAP_SHORTCUT_HELP).toContainEqual({ keys: "Ctrl/Cmd + Enter", action: "Focus the body editor" });
    expect(MINDMAP_SHORTCUT_HELP).toContainEqual({ keys: "Ctrl/Cmd + Space", action: "Collapse or expand the body pane" });
    expect(MINDMAP_SHORTCUT_HELP).toContainEqual({ keys: "Shift + Tab", action: "Promote the current node" });
  });
});

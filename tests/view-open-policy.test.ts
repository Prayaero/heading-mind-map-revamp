import { describe, expect, it } from "vitest";
import { decideMindmapOpenPolicy } from "../src/view-open-policy";

describe("mindmap open policy", () => {
  it("reuses the current mind map when the leaf already shows the same file", () => {
    expect(decideMindmapOpenPolicy({ filePath: "notes/a.md" }, "notes/a.md")).toBe("reuse-current-mindmap");
  });

  it("doesn't reuse an existing mind map that has another file open, to avoid overwriting its state", () => {
    expect(decideMindmapOpenPolicy({ filePath: "notes/a.md" }, "notes/b.md")).toBe("open-in-new-tab");
  });

  it("opens a new tab when the current leaf isn't a mind map, keeping the source view", () => {
    expect(decideMindmapOpenPolicy(null, "notes/a.md")).toBe("open-in-new-tab");
  });
});

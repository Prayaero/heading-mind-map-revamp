import { describe, expect, it } from "vitest";
import { resolveFileNodePath } from "../src/file-node-target";

describe("file node target", () => {
  it("prefers the real path when Obsidian resolves the actual target file", () => {
    expect(resolveFileNodePath("Project.md", "notes/Project.md")).toBe("notes/Project.md");
  });

  it("keeps the node's stored path for error messages when nothing resolves", () => {
    expect(resolveFileNodePath("Missing.md", undefined)).toBe("Missing.md");
  });
});

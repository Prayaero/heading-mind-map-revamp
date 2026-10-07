import { describe, expect, it } from "vitest";
import { decideMindmapStateLoadPolicy } from "../src/view-state-load-policy";

describe("mindmap state load policy", () => {
  it("loads the target file when a file path is present", () => {
    expect(decideMindmapStateLoadPolicy("notes/map.md", true)).toBe("load-file");
  });

  it("activates the default mind map when setState receives an empty state", () => {
    expect(decideMindmapStateLoadPolicy(undefined, true)).toBe("activate-default");
  });

  it("waits for setState when onOpen hasn't received leaf state yet, to avoid opening the view twice", () => {
    expect(decideMindmapStateLoadPolicy(undefined, false)).toBe("await-state");
  });
});

import { describe, expect, it } from "vitest";
import { chooseMindmapSourcePath } from "../src/active-mindmap-file";

describe("choose mindmap source path", () => {
  it("prefers the mind map file when the current mind map view has an associated file", () => {
    expect(
      chooseMindmapSourcePath(
        "maps/current.md",
        { path: "notes/active.md", extension: "md" },
        "Mindmaps/Untitled mind map.md"
      )
    ).toBe("maps/current.md");
  });

  it("uses the active Markdown file when there is no current mind map file", () => {
    expect(
      chooseMindmapSourcePath(
        undefined,
        { path: "notes/active.md", extension: "md" },
        "Mindmaps/Untitled mind map.md"
      )
    ).toBe("notes/active.md");
  });

  it("uses the default mind map file when no Markdown context is available", () => {
    expect(
      chooseMindmapSourcePath(
        undefined,
        { path: "assets/image.png", extension: "png" },
        "Mindmaps/Untitled mind map.md"
      )
    ).toBe("Mindmaps/Untitled mind map.md");
  });
});

import { describe, expect, it } from "vitest";
import { getFileNodeOptions } from "../src/markdown-file-options";

describe("markdown file node options", () => {
  it("excludes the current mind map file when adding a file node to avoid self-reference", () => {
    const options = getFileNodeOptions(
      [
        { path: "maps/current.md" },
        { path: "notes/reference.md" }
      ],
      "maps/current.md"
    );

    expect(options.map((file) => file.path)).toEqual(["notes/reference.md"]);
  });

  it("keeps all candidates when there is no current file path", () => {
    const options = getFileNodeOptions([{ path: "notes/a.md" }, { path: "notes/b.md" }], undefined);

    expect(options.map((file) => file.path)).toEqual(["notes/a.md", "notes/b.md"]);
  });
});

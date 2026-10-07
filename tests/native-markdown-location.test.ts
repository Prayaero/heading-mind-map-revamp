import { describe, expect, it } from "vitest";
import { parseMindmapMarkdown, serializeMindmapMarkdown } from "../src/mindmap-model";
import { buildOutlineTreeFromMarkdown } from "../src/mindmap-model";
import { getNativeHeadingOrdinal, getNativeMarkdownFilePath, getNativeMarkdownPosition } from "../src/native-markdown-location";

describe("native markdown location", () => {
  it("locates a heading node at its original Markdown line", () => {
    const root = parseMindmapMarkdown("maps/product.md", "# Product\n\nBody\n\n## Goal\n\nDetails");
    expect(getNativeMarkdownPosition(root, root.children[0].children[0].id)).toEqual({ line: 4, ch: 0 });
  });

  it("cross-file outline nodes open the target file while the file node itself stays in the current file", () => {
    const root = parseMindmapMarkdown("maps/product.md", "# Product\n\n## [[notes/spec.md|Spec]]");
    const fileNode = root.children[0].children[0];
    const outlineNode = { ...fileNode, id: "outline", type: "heading" as const, filePath: "notes/spec.md", sourceLine: 8 };
    fileNode.children.push(outlineNode);

    expect(getNativeMarkdownFilePath(root, fileNode.id, "maps/product.md")).toBe("maps/product.md");
    expect(getNativeMarkdownFilePath(root, outlineNode.id, "maps/product.md")).toBe("notes/spec.md");
  });

  it("refreshes a node's native editor line after a structural change is saved", () => {
    const root = parseMindmapMarkdown("maps/product.md", "# Product\n\n## Goal");
    root.children[0].body = "First paragraph\n\nSecond paragraph";
    serializeMindmapMarkdown(root);

    expect(getNativeMarkdownPosition(root, root.children[0].children[0].id)).toEqual({ line: 6, ch: 0 });
  });

  it("numbers real headings in document order, independent of line numbers", () => {
    const root = parseMindmapMarkdown("maps/product.md", "# Product\n\n## Goal\n\n### Metric\n\n## Risk\n");
    const [product] = root.children;
    const [goal, risk] = product.children;

    expect(getNativeHeadingOrdinal(root, product.id)).toBe(0);
    expect(getNativeHeadingOrdinal(root, goal.id)).toBe(1);
    expect(getNativeHeadingOrdinal(root, goal.children[0].id)).toBe(2);
    expect(getNativeHeadingOrdinal(root, risk.id)).toBe(3);
  });

  it("has no ordinal for the document root, list-item nodes or nodes of an expanded file outline", () => {
    const root = parseMindmapMarkdown("maps/product.md", "# Product\n\n- Item\n\n## [[notes/spec.md|spec]]\n", {
      expandListItems: true
    });
    const fileNode = root.children[0].children.find((node) => node.type === "file")!;
    fileNode.children = buildOutlineTreeFromMarkdown("notes/spec.md", "# External");
    fileNode.outlineExpanded = true;
    const listItem = root.children[0].children.find((node) => node.virtual)!;

    expect(getNativeHeadingOrdinal(root, root.id)).toBeNull();
    expect(getNativeHeadingOrdinal(root, listItem.id)).toBeNull();
    expect(getNativeHeadingOrdinal(root, fileNode.children[0].id)).toBeNull();
    expect(getNativeHeadingOrdinal(root, fileNode.id)).toBe(1);
  });
});

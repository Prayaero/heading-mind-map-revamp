import { describe, expect, it } from "vitest";
import { createFileNode, createTextNode, type MindNode } from "../src/mindmap-model";
import {
  expandFileOutlineNode,
  findExpandedFileNode,
  refreshExpandedFileOutline
} from "../src/file-outline-runtime";

function rootWithFile(fileNode: MindNode): MindNode {
  return {
    ...createTextNode("root"),
    id: "root",
    type: "document",
    children: [fileNode]
  };
}

describe("file outline runtime", () => {
  it("finds file nodes that are expanded and resolve to the target path", () => {
    const fileNode = { ...createFileNode("notes/target.md"), outlineExpanded: true };
    const root = rootWithFile(fileNode);

    expect(findExpandedFileNode(root, "notes/target.md", (node) => ({ path: node.filePath ?? "" }))).toBe(fileNode);
  });

  it("refreshes the outline children of an expanded file node", async () => {
    const fileNode = { ...createFileNode("notes/target.md"), outlineExpanded: true };
    const root = rootWithFile(fileNode);

    const refreshed = await refreshExpandedFileOutline(
      root,
      { path: "notes/target.md" },
      (node) => ({ path: node.filePath ?? "" }),
      () => Promise.resolve(["# Goal", "", "## Subgoal"].join("\n"))
    );

    expect(refreshed).toBe(true);
    expect(fileNode.children.map((node) => node.title)).toEqual(["Goal"]);
    expect(fileNode.children[0].children.map((node) => node.title)).toEqual(["Subgoal"]);
  });

  it("expanding a file node mounts only the target file's headings, not its root node again", async () => {
    const fileNode = createFileNode("notes/target.md");
    const root = rootWithFile(fileNode);

    await expandFileOutlineNode(
      fileNode,
      () => ({ path: "notes/target.md" }),
      () => Promise.resolve(["# Goal", "", "## Subgoal"].join("\n"))
    );

    expect(root.children).toEqual([fileNode]);
    expect(fileNode.children.map((node) => node.title)).toEqual(["Goal"]);
    expect(fileNode.children[0].children.map((node) => node.title)).toEqual(["Subgoal"]);
    expect(fileNode.children.some((node) => node.type === "document" || node.title === "target")).toBe(false);
  });

  it("expanding a file node reads the target file and reports an empty outline", async () => {
    const fileNode = createFileNode("notes/empty.md");

    const result = await expandFileOutlineNode(
      fileNode,
      () => ({ path: "notes/empty.md" }),
      () => Promise.resolve("Body without a title")
    );

    expect(result).toEqual({ ok: true, empty: true });
    expect(fileNode.outlineExpanded).toBe(true);
    expect(fileNode.children).toEqual([]);
  });

  it("returns a clear failure when the file path is missing", async () => {
    const result = await expandFileOutlineNode(
      { ...createFileNode("notes/missing.md"), filePath: undefined },
      () => null,
      () => Promise.resolve("")
    );

    expect(result).toEqual({ ok: false, message: "This file node has no file path." });
  });
});

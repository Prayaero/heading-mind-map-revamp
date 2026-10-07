import { describe, expect, it } from "vitest";
import { buildOutlineTreeFromMarkdown, parseMindmapMarkdown, serializeMindmapMarkdown } from "../src/mindmap-model";
import {
  addChildNode,
  addFileChildNode,
  addSiblingNode,
  deleteNode,
  canEditNodeTitle,
  canMoveNodeTo,
  moveNodeTo,
  moveNodeWithinSiblings,
  promoteNode,
  READONLY_OUTLINE_MESSAGE,
  toggleNodeFold
} from "../src/mindmap-operations";

function findByTitle(root: ReturnType<typeof parseMindmapMarkdown>, title: string) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) continue;
    if (node.title === title) return node;
    stack.unshift(...node.children);
  }
  throw new Error(`Node not found: ${title}`);
}

describe("mindmap node operations", () => {
  it("adds a child under the selected node and writes it back at the right Markdown level", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "## Goal", "", "Goal body."].join("\n")
    );

    const result = addChildNode(root, findByTitle(root, "Goal").id, "New child");

    expect(result).toMatchObject({ ok: true });
    expect(findByTitle(root, "New child")).toMatchObject({ type: "heading", headingLevel: 3 });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# Product",
        "",
        "## Goal",
        "",
        "Goal body.",
        "",
        "### New child",
        ""
      ].join("\n")
    );
  });

  it("adding a file node writes only the Markdown link heading, with no plugin note text", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "## Goal"].join("\n")
    );

    const result = addFileChildNode(root, findByTitle(root, "Goal").id, "notes/project.md");

    expect(result).toMatchObject({ ok: true });
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# Product", "", "## Goal", "", "### [[notes/project.md|project]]", ""].join("\n")
    );
  });

  it("returns a clear failure and leaves Markdown unchanged when adding a child under a level-6 node", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# L1",
        "",
        "## L2",
        "",
        "### L3",
        "",
        "#### L4",
        "",
        "##### L5",
        "",
        "###### L6"
      ].join("\n")
    );
    const before = serializeMindmapMarkdown(root);

    const result = addChildNode(root, findByTitle(root, "L6").id, "Over limit");

    expect(result).toMatchObject({
      ok: false,
      message: "Headings support at most six levels; you can't add a child under a level-6 node."
    });
    expect(serializeMindmapMarkdown(root)).toBe(before);
  });

  it("adds a sibling after the selected node", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "## Goal", "", "## Risk"].join("\n")
    );

    const result = addSiblingNode(root, findByTitle(root, "Goal").id, "Scope");

    expect(result).toMatchObject({ ok: true });
    expect(findByTitle(root, "Product").children.map((node) => node.title)).toEqual(["Goal", "Scope", "Risk"]);
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# Product", "", "## Goal", "", "## Scope", "", "## Risk", ""].join("\n")
    );
  });

  it("adds a sibling H1 node after an H1", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "## Goal", "", "# Retro"].join("\n")
    );

    const result = addSiblingNode(root, findByTitle(root, "Product").id, "Archive");

    expect(result).toMatchObject({ ok: true });
    expect(root.children.map((node) => node.title)).toEqual(["Product", "Archive", "Retro"]);
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# Product", "", "## Goal", "", "# Archive", "", "# Retro", ""].join("\n")
    );
  });

  it("deleting a node removes its subtree and moves the selection to a neighbor", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "## Goal", "", "### Subgoal", "", "## Risk"].join("\n")
    );

    const result = deleteNode(root, findByTitle(root, "Goal").id);

    expect(result).toEqual({ ok: true, selectedNodeId: findByTitle(root, "Risk").id });
    expect(findByTitle(root, "Product").children.map((node) => node.title)).toEqual(["Risk"]);
    expect(serializeMindmapMarkdown(root)).toBe(["# Product", "", "## Risk", ""].join("\n"));
  });

  it("moves a node up and down among its siblings", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "## A", "", "## B", "", "## C"].join("\n")
    );

    expect(moveNodeWithinSiblings(root, findByTitle(root, "B").id, "up")).toMatchObject({ ok: true });
    expect(findByTitle(root, "Product").children.map((node) => node.title)).toEqual(["B", "A", "C"]);

    expect(moveNodeWithinSiblings(root, findByTitle(root, "B").id, "down")).toMatchObject({ ok: true });
    expect(findByTitle(root, "Product").children.map((node) => node.title)).toEqual(["A", "B", "C"]);
  });

  it("promoting a node moves it after its parent and lowers its subtree's heading levels", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product",
        "",
        "## A",
        "",
        "### B",
        "",
        "#### C",
        "",
        "## D"
      ].join("\n")
    );

    const result = promoteNode(root, findByTitle(root, "B").id);

    expect(result).toMatchObject({ ok: true });
    expect(findByTitle(root, "Product").children.map((node) => node.title)).toEqual(["A", "B", "D"]);
    expect(findByTitle(root, "A").children).toEqual([]);
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# Product",
        "",
        "## A",
        "",
        "## B",
        "",
        "### C",
        "",
        "## D",
        ""
      ].join("\n")
    );
  });

  it("space collapses the mind map subtree without toggling the body pane state", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "Root body.", "", "## Goal"].join("\n")
    );

    expect(toggleNodeFold(root, root.id)).toEqual({ ok: true, selectedNodeId: root.id });
    expect(root.bodyCollapsed).toBe(false);
    expect(root.childrenCollapsed).toBe(true);

    const child = findByTitle(root, "Goal");
    child.body = "Goal body.";
    child.children.push(parseMindmapMarkdown("tmp.md", "# Child"));
    expect(toggleNodeFold(root, child.id)).toEqual({ ok: true, selectedNodeId: child.id });
    expect(child.bodyCollapsed).toBe(false);
    expect(child.childrenCollapsed).toBe(true);
  });

  it("rejects editing expanded cross-file outline nodes to avoid changes that can't be written back", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "## [[notes/project.md|project]]"].join("\n")
    );
    const fileNode = findByTitle(root, "project");
    fileNode.outlineExpanded = true;
    fileNode.children = buildOutlineTreeFromMarkdown("notes/project.md", "# External title");

    expect(addChildNode(root, fileNode.children[0].id, "Bad edit")).toMatchObject({
      ok: false,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(deleteNode(root, fileNode.children[0].id)).toMatchObject({
      ok: false,
      message: READONLY_OUTLINE_MESSAGE
    });
  });

  it("rejects editing virtual list-item nodes as real Markdown heading nodes", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "- Goal one", "- Goal two"].join("\n"),
      { expandListItems: true }
    );
    const listItem = findByTitle(root, "Goal one");
    const before = serializeMindmapMarkdown(root);

    expect(addChildNode(root, listItem.id, "Bad add")).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(addSiblingNode(root, listItem.id, "Bad add")).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(deleteNode(root, listItem.id)).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(moveNodeWithinSiblings(root, listItem.id, "down")).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(promoteNode(root, listItem.id)).toMatchObject({
      ok: false,
      selectedNodeId: listItem.id,
      message: READONLY_OUTLINE_MESSAGE
    });
    expect(serializeMindmapMarkdown(root)).toBe(before);
  });

  it("a file node's title comes from the target file name and can't be edited as a normal heading", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "## [[notes/project.md|project]]"].join("\n")
    );

    expect(canEditNodeTitle(root, findByTitle(root, "project").id)).toEqual({
      ok: false,
      message: "A file node's title comes from the target Markdown file name."
    });
  });

  it("editing a file node title inside an external outline reports the read-only preview first", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "## [[notes/project.md|project]]"].join("\n")
    );
    const fileNode = findByTitle(root, "project");
    fileNode.outlineExpanded = true;
    fileNode.children = buildOutlineTreeFromMarkdown(
      "notes/project.md",
      "# External title\n\n## [[notes/other.md|other]]"
    );
    const nestedFileNode = fileNode.children[0].children[0];

    expect(canEditNodeTitle(root, nestedFileNode.id)).toEqual({
      ok: false,
      message: READONLY_OUTLINE_MESSAGE
    });
  });

  it("ignores virtual list-item nodes when reordering and deleting real headings", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product", "", "- List item", "", "## A", "", "## B"].join("\n"),
      { expandListItems: true }
    );
    const listItem = findByTitle(root, "List item");
    const headingA = findByTitle(root, "A");
    const headingB = findByTitle(root, "B");
    const product = findByTitle(root, "Product");

    expect(moveNodeWithinSiblings(root, headingA.id, "up")).toMatchObject({
      ok: false,
      selectedNodeId: headingA.id,
      message: "This node is already at the edge of its siblings."
    });
    expect(product.children.map((node) => node.id)).toEqual([listItem.id, headingA.id, headingB.id]);

    expect(deleteNode(root, headingA.id)).toEqual({ ok: true, selectedNodeId: headingB.id });
    expect(product.children.map((node) => node.id)).toEqual([listItem.id, headingB.id]);
    expect(serializeMindmapMarkdown(root)).toBe(["# Product", "", "- List item", "", "## B", ""].join("\n"));
  });
});

describe("moveNodeTo (drag and drop)", () => {
  const sample = ["# Product", "", "## A", "", "### A1", "", "## B", "", "## C"].join("\n");
  const load = () => parseMindmapMarkdown("projects/map.md", sample);

  it("moves a node before a sibling", () => {
    const root = load();
    const result = moveNodeTo(root, findByTitle(root, "C").id, findByTitle(root, "A").id, "before");

    expect(result).toEqual({ ok: true, selectedNodeId: findByTitle(root, "C").id });
    expect(findByTitle(root, "Product").children.map((node) => node.title)).toEqual(["C", "A", "B"]);
  });

  it("moves a node after a sibling that is later in the list", () => {
    const root = load();
    moveNodeTo(root, findByTitle(root, "A").id, findByTitle(root, "B").id, "after");

    expect(findByTitle(root, "Product").children.map((node) => node.title)).toEqual(["B", "A", "C"]);
  });

  it("re-parents a node as the last child and shifts its subtree's heading levels", () => {
    const root = load();
    moveNodeTo(root, findByTitle(root, "A").id, findByTitle(root, "B").id, "child");

    expect(serializeMindmapMarkdown(root)).toBe(
      ["# Product", "", "## B", "", "### A", "", "#### A1", "", "## C", ""].join("\n")
    );
  });

  it("promotes a node when it is dropped next to a shallower node", () => {
    const root = load();
    moveNodeTo(root, findByTitle(root, "A1").id, findByTitle(root, "C").id, "after");

    expect(serializeMindmapMarkdown(root)).toBe(
      ["# Product", "", "## A", "", "## B", "", "## C", "", "## A1", ""].join("\n")
    );
  });

  it("allows dropping onto the document root only as a child", () => {
    const root = load();
    expect(moveNodeTo(root, findByTitle(root, "A1").id, root.id, "before")).toMatchObject({ ok: false });
    expect(moveNodeTo(root, findByTitle(root, "A1").id, root.id, "child")).toMatchObject({ ok: true });
    expect(root.children.map((node) => node.title)).toEqual(["Product", "A1"]);
    expect(findByTitle(root, "A1").headingLevel).toBe(1);
  });

  it("refuses to move a node into itself, its subtree, or the document root itself", () => {
    const root = load();
    const a = findByTitle(root, "A");
    expect(moveNodeTo(root, a.id, a.id, "after")).toMatchObject({ ok: false });
    expect(moveNodeTo(root, a.id, findByTitle(root, "A1").id, "child")).toMatchObject({ ok: false });
    expect(moveNodeTo(root, root.id, a.id, "child")).toMatchObject({ ok: false });
    expect(findByTitle(root, "Product").children.map((node) => node.title)).toEqual(["A", "B", "C"]);
  });

  it("refuses moves that would push a subtree past heading level six", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# L1", "", "## L2", "", "### L3", "", "#### L4", "", "##### L5", "", "###### L6", "", "# Other", "", "## Sub", "", "### Sub2"].join("\n")
    );
    const result = moveNodeTo(root, findByTitle(root, "Other").id, findByTitle(root, "L5").id, "child");

    expect(result).toMatchObject({ ok: false, message: "Moving this node there would exceed six heading levels." });
    expect(canMoveNodeTo(root, findByTitle(root, "Sub2").id, findByTitle(root, "L5").id, "child")).toMatchObject({ ok: true });
  });

  it("refuses to move read-only list items or nodes inside an expanded file outline", () => {
    const root = parseMindmapMarkdown("projects/map.md", ["# Product", "", "- Item", "", "## A", "", "## [[notes/p.md|p]]"].join("\n"), {
      expandListItems: true
    });
    const fileNode = findByTitle(root, "p");
    fileNode.children = buildOutlineTreeFromMarkdown("notes/p.md", "# External");
    fileNode.outlineExpanded = true;

    expect(moveNodeTo(root, findByTitle(root, "Item").id, findByTitle(root, "A").id, "after")).toMatchObject({ ok: false });
    expect(moveNodeTo(root, findByTitle(root, "External").id, findByTitle(root, "A").id, "after")).toMatchObject({ ok: false });
    expect(moveNodeTo(root, findByTitle(root, "A").id, findByTitle(root, "External").id, "before")).toMatchObject({ ok: false });
  });

  it("keeps the moved node's body and survives a Markdown round trip", () => {
    const root = parseMindmapMarkdown("projects/map.md", ["# Product", "", "## A", "", "A body.", "", "## B"].join("\n"));
    moveNodeTo(root, findByTitle(root, "A").id, findByTitle(root, "B").id, "after");
    const reparsed = parseMindmapMarkdown("projects/map.md", serializeMindmapMarkdown(root));

    expect(findByTitle(reparsed, "Product").children.map((node) => node.title)).toEqual(["B", "A"]);
    expect(findByTitle(reparsed, "A").body).toBe("A body.");
  });
});

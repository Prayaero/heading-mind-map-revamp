import { describe, expect, it } from "vitest";
import { createTextNode, type MindNode } from "../src/mindmap-model";
import { getDirectionalNodeId } from "../src/mindmap-navigation";

function node(id: string, title = id, children: MindNode[] = []): MindNode {
  return {
    ...createTextNode(title),
    id,
    children
  };
}

describe("getDirectionalNodeId", () => {
  const root = node("root", "root", [
    node("a"),
    node("b", "b", [
      node("b1"),
      node("b2")
    ]),
    node("c")
  ]);

  it("left and right arrows move between parent and child nodes", () => {
    expect(getDirectionalNodeId(root, "root", "right")).toBe("a");
    expect(getDirectionalNodeId(root, "b", "right")).toBe("b1");
    expect(getDirectionalNodeId(root, "b1", "left")).toBe("b");
    expect(getDirectionalNodeId(root, "root", "left")).toBe("root");
  });

  it("up and down arrows move between sibling nodes", () => {
    expect(getDirectionalNodeId(root, "root", "down")).toBe("root");
    expect(getDirectionalNodeId(root, "a", "down")).toBe("b");
    expect(getDirectionalNodeId(root, "b", "down")).toBe("c");
    expect(getDirectionalNodeId(root, "b1", "down")).toBe("b2");
    expect(getDirectionalNodeId(root, "b2", "down")).toBe("b2");
    expect(getDirectionalNodeId(root, "a", "up")).toBe("a");
    expect(getDirectionalNodeId(root, "root", "up")).toBe("root");
  });

  it("the right arrow doesn't enter hidden children after a subtree is collapsed", () => {
    const collapsed = node("root", "root", [
      node("a"),
      { ...node("b", "b", [node("b1")]), childrenCollapsed: true }
    ]);

    expect(getDirectionalNodeId(collapsed, "b", "right")).toBe("b");
  });
});

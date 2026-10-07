import { describe, expect, it } from "vitest";
import { BRANCH_COLORS, getBranchColor, getNodeAppearances, getNodeLevelClass } from "../src/mindmap-appearance";
import { parseMindmapMarkdown } from "../src/mindmap-model";

const title = (root: ReturnType<typeof parseMindmapMarkdown>, name: string) => {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.shift()!;
    if (node.title === name) return node;
    stack.unshift(...node.children);
  }
  throw new Error(`Node not found: ${name}`);
};

describe("mind map appearance", () => {
  it("starts coloring branches below a lone top-level heading", () => {
    const root = parseMindmapMarkdown("map.md", "# Map\n\n## A\n\n### A1\n\n## B\n\n## C\n");
    const appearances = getNodeAppearances(root);

    expect(appearances.get(root.id)).toEqual({ branch: -1, depth: 0 });
    expect(appearances.get(title(root, "Map").id)).toEqual({ branch: -1, depth: 0 });
    expect(appearances.get(title(root, "A").id)).toEqual({ branch: 0, depth: 1 });
    expect(appearances.get(title(root, "A1").id)).toEqual({ branch: 0, depth: 2 });
    expect(appearances.get(title(root, "B").id)).toEqual({ branch: 1, depth: 1 });
    expect(appearances.get(title(root, "C").id)).toEqual({ branch: 2, depth: 1 });
  });

  it("colors the top-level headings as branches when there are several", () => {
    const root = parseMindmapMarkdown("map.md", "# One\n\n## One A\n\n# Two\n");
    const appearances = getNodeAppearances(root);

    expect(appearances.get(title(root, "One").id)).toEqual({ branch: 0, depth: 1 });
    expect(appearances.get(title(root, "One A").id)).toEqual({ branch: 0, depth: 2 });
    expect(appearances.get(title(root, "Two").id)).toEqual({ branch: 1, depth: 1 });
  });

  it("cycles through the palette and leaves the root uncolored", () => {
    expect(getBranchColor(-1)).toBeNull();
    expect(getBranchColor(0)).toBe(BRANCH_COLORS[0]);
    expect(getBranchColor(BRANCH_COLORS.length)).toBe(BRANCH_COLORS[0]);
  });

  it("derives the size-affecting level class from the heading level", () => {
    const root = parseMindmapMarkdown("map.md", "# One\n\n## Two\n\n###### Six\n");
    expect(getNodeLevelClass(root)).toBe("is-level-0");
    expect(getNodeLevelClass(title(root, "One"))).toBe("is-level-1");
    expect(getNodeLevelClass(title(root, "Six"))).toBe("is-level-4");
  });
});

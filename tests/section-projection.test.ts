import { describe, expect, it } from "vitest";
import { parseMindmapMarkdown } from "../src/mindmap-model";
import { getSectionProjection, listHeadingLines } from "../src/section-projection";

describe("section projection", () => {
  it("projects only the current heading's body, not adjacent headings", () => {
    const markdown = "# Product\n\nOverview\n\n## Goal\n\nGoal body\n\n## Risk\n\nRisk body\n";
    const root = parseMindmapMarkdown("product.md", markdown);
    const goal = root.children[0].children[0];
    const range = getSectionProjection(markdown, goal);

    expect(markdown.slice(range.from, range.to)).toBe("\nGoal body\n\n");
  });

  it("ends the current node's body at any lower-level heading", () => {
    const markdown = "# Product\n\n## Goal\n\nGoal body\n\n### Measure\n\nMetric body\n";
    const root = parseMindmapMarkdown("product.md", markdown);
    const goal = root.children[0].children[0];
    const range = getSectionProjection(markdown, goal);

    expect(markdown.slice(range.from, range.to)).toBe("\nGoal body\n\n");
  });

  it("the document root projection keeps text between the frontmatter and the first heading", () => {
    const markdown = "---\ntags: [map]\n---\n\nPreface\n\n# Product\n";
    const root = parseMindmapMarkdown("product.md", markdown);
    const range = getSectionProjection(markdown, root);

    expect(markdown.slice(range.from, range.to)).toBe("\nPreface\n\n");
  });

  it("Windows line endings still project the body by original character offsets", () => {
    const markdown = "# Product\r\n\r\n## Goal\r\n\r\nGoal body\r\n\r\n## Risk\r\n";
    const root = parseMindmapMarkdown("product.md", markdown);
    const range = getSectionProjection(markdown, root.children[0].children[0]);

    expect(markdown.slice(range.from, range.to)).toBe("\r\nGoal body\r\n\r\n");
  });

  it("hash signs inside code fences don't cut off the body range", () => {
    const markdown = "# Product\n\n```md\n# Not a heading\n```\n\n## Goal\n";
    const root = parseMindmapMarkdown("product.md", markdown);
    const range = getSectionProjection(markdown, root.children[0]);

    expect(markdown.slice(range.from, range.to)).toContain("# Not a heading");
  });

  it("can include the node's own heading line at the start of the range", () => {
    const markdown = "# Product\n\n## Goal\n\nGoal body\n\n## Risk\n";
    const root = parseMindmapMarkdown("product.md", markdown);
    const range = getSectionProjection(markdown, root.children[0].children[0], 0, { includeHeading: true });

    expect(markdown.slice(range.from, range.to)).toBe("## Goal\n\nGoal body\n\n");
  });

  it("ignores includeHeading for the document root, which has no heading line", () => {
    const markdown = "Preface\n\n# Product\n";
    const root = parseMindmapMarkdown("product.md", markdown);

    expect(getSectionProjection(markdown, root, 0, { includeHeading: true })).toEqual(getSectionProjection(markdown, root));
  });

  it("lists heading lines in document order and skips code fences and non-headings", () => {
    const markdown = "Intro\n\n# One\n\n```\n# not a heading\n```\n\n## Two\n\n#hashtag\n\n    # indented code\n\n### Three\r\n";

    expect(listHeadingLines(markdown)).toEqual([2, 8, 14]);
  });
});

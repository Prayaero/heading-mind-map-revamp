import { describe, expect, it } from "vitest";
import {
  buildOutlineTree,
  buildOutlineTreeFromMarkdown,
  applyListItemExpansion,
  createFileNode,
  createStarterMindmap,
  deserializeMindmap,
  parseMindmapMarkdown,
  serializeMindmap,
  serializeMindmapMarkdown
} from "../src/mindmap-model";

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

describe("buildOutlineTree", () => {
  it("converts a flat Markdown heading cache into hierarchical mind map nodes", () => {
    const nodes = buildOutlineTree("notes/project.md", [
      { heading: "Goal", level: 1 },
      { heading: "Scope", level: 2 },
      { heading: "Milestone", level: 2 },
      { heading: "Week one", level: 3 },
      { heading: "Appendix", level: 1 }
    ]);

    expect(nodes).toMatchObject([
      {
        type: "heading",
        title: "Goal",
        children: [
          { title: "Scope", children: [] },
          { title: "Milestone", children: [{ title: "Week one", children: [] }] }
        ]
      },
      {
        type: "heading",
        title: "Appendix",
        children: []
      }
    ]);
  });

  it("ignores empty headings and attaches skipped levels to the nearest available parent", () => {
    const nodes = buildOutlineTree("notes/project.md", [
      { heading: "Root", level: 1 },
      { heading: "", level: 2 },
      { heading: "Direct level three", level: 3 }
    ]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].children.map((node) => node.title)).toEqual(["Direct level three"]);
  });

  it("keeps heading bodies for read-only preview when building a cross-file outline from target Markdown", () => {
    const nodes = buildOutlineTreeFromMarkdown(
      "notes/project.md",
      [
        "# Project",
        "",
        "Project body.",
        "",
        "## Goal",
        "",
        "- Goal one",
        "",
        "## Risk",
        "",
        "Risk body."
      ].join("\n")
    );

    expect(nodes).toMatchObject([
      {
        title: "Project",
        body: "Project body.",
        children: [
          { title: "Goal", body: "- Goal one" },
          { title: "Risk", body: "Risk body." }
        ]
      }
    ]);
  });

  it("does not synthesize a file-name root for an external outline when the target Markdown has no level-1 heading", () => {
    const nodes = buildOutlineTreeFromMarkdown(
      "notes/project.md",
      ["File intro.", "", "## Goal", "", "Goal body."].join("\n")
    );

    expect(nodes).toMatchObject([{ title: "Goal", body: "Goal body." }]);
  });
});

describe("Mindmap serialization", () => {
  it("restores file nodes and collapsed state after serializing", () => {
    const root = createStarterMindmap();
    root.children.push(createFileNode("notes/project.md"));
    root.bodyCollapsed = true;

    const restored = deserializeMindmap(serializeMindmap(root));

    expect(restored.title).toBe("My mind map");
    expect(restored.bodyCollapsed).toBe(true);
    expect(restored.children[1]).toMatchObject({
      type: "file",
      title: "project",
      filePath: "notes/project.md"
    });
  });
});

describe("Mindmap Markdown files", () => {
  it("parses Markdown heading levels into mind map nodes and puts only the text under each heading into that node's body", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product plan",
        "",
        "Root body first paragraph.",
        "",
        "## Goal",
        "",
        "- Supports headings and body",
        "",
        "### Subgoal",
        "",
        "Subgoal body.",
        "",
        "## Risk",
        "",
        "Risk body."
      ].join("\n")
    );

    expect(root).toMatchObject({
      type: "document",
      title: "map",
      body: "",
      children: [
        {
          type: "heading",
          title: "Product plan",
          body: "Root body first paragraph.",
          headingLevel: 1,
          children: [
            {
              type: "heading",
              title: "Goal",
              body: "- Supports headings and body",
              headingLevel: 2,
              children: [
                {
                  title: "Subgoal",
                  body: "Subgoal body.",
                  headingLevel: 3,
                  children: []
                }
              ]
            },
            {
              title: "Risk",
              body: "Risk body.",
              headingLevel: 2,
              children: []
            }
          ]
        }
      ]
    });
  });

  it("strips only valid closing hashes from headings and keeps a trailing # in the heading text", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# C#", "", "## Heading ###"].join("\n")
    );

    const heading = root.children[0];
    expect(heading.title).toBe("C#");
    expect(heading.children[0].title).toBe("Heading");
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# C#", "", "## Heading", ""].join("\n")
    );
  });

  it("parses headings indented up to three spaces but not four-space code as headings", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "   # Product plan",
        "",
        "   ## Goal",
        "",
        "    ### Fake heading in code"
      ].join("\n")
    );

    const heading = root.children[0];
    expect(heading.title).toBe("Product plan");
    expect(heading.children[0]).toMatchObject({
      title: "Goal",
      body: "    ### Fake heading in code"
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# Product plan",
        "",
        "## Goal",
        "",
        "    ### Fake heading in code",
        ""
      ].join("\n")
    );
  });

  it("detects code blocks by fence marker and length, ignoring shorter fence examples inside a longer fence", () => {
    const markdown = [
      "# Product plan",
      "",
      "````",
      "```",
      "# Fake heading in code",
      "```",
      "````",
      "",
      "## Real heading"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown);
    const heading = root.children[0];

    expect(heading.children.map((node) => node.title)).toEqual(["Real heading"]);
    expect(heading.body).toBe(["````", "```", "# Fake heading in code", "```", "````"].join("\n"));
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("does not end a code block early or misparse headings when the closing fence has trailing non-whitespace text", () => {
    const markdown = [
      "# Product plan",
      "",
      "```",
      "```not-close",
      "# Fake heading in code",
      "```",
      "",
      "## Real heading"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown);
    const heading = root.children[0];

    expect(heading.children.map((node) => node.title)).toEqual(["Real heading"]);
    expect(heading.body).toBe(["```", "```not-close", "# Fake heading in code", "```"].join("\n"));
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("uses the file name as the document root title when there is no level-1 heading, keeping original heading levels", () => {
    const root = parseMindmapMarkdown(
      "notes/project-map.md",
      [
        "Mind map intro.",
        "",
        "## Part one",
        "",
        "Part one body."
      ].join("\n")
    );

    expect(root).toMatchObject({
      type: "document",
      title: "project-map",
      body: "Mind map intro.",
      children: [
        {
          title: "Part one",
          body: "Part one body.",
          headingLevel: 2
        }
      ]
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "Mind map intro.",
        "",
        "## Part one",
        "",
        "Part one body.",
        ""
      ].join("\n")
    );
  });

  it("uses the file name as the root title and the whole content as the root body when there are no headings", () => {
    const root = parseMindmapMarkdown(
      "notes/free-note.md",
      ["Free note first paragraph.", "", "- List content"].join("\n")
    );

    expect(root).toMatchObject({
      title: "free-note",
      body: "Free note first paragraph.\n\n- List content",
      children: []
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      ["Free note first paragraph.", "", "- List content", ""].join("\n")
    );
  });

  it("keeps YAML frontmatter at the top of the file when there are no headings", () => {
    const root = parseMindmapMarkdown(
      "notes/free-note.md",
      ["---", "tags:", "  - project", "---", "", "Free note body."].join("\n")
    );

    expect(root).toMatchObject({
      title: "free-note",
      body: "Free note body.",
      preface: ["---", "tags:", "  - project", "---"].join("\n"),
      children: []
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      ["---", "tags:", "  - project", "---", "", "Free note body.", ""].join("\n")
    );
  });

  it("keeps the full frontmatter when there are no headings and the frontmatter contains blank lines", () => {
    const root = parseMindmapMarkdown(
      "notes/free-note.md",
      ["---", "title: Free note", "", "tags:", "  - project", "---", "", "Free note body."].join("\n")
    );

    expect(root).toMatchObject({
      title: "free-note",
      body: "Free note body.",
      preface: ["---", "title: Free note", "", "tags:", "  - project", "---"].join("\n"),
      children: []
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "---",
        "title: Free note",
        "",
        "tags:",
        "  - project",
        "---",
        "",
        "Free note body.",
        ""
      ].join("\n")
    );
  });

  it("indented --- and # inside a YAML block scalar neither end the frontmatter nor parse as headings", () => {
    const root = parseMindmapMarkdown(
      "notes/free-note.md",
      [
        "---",
        "description: |",
        "  ---",
        "  # This is still YAML string content",
        "tags:",
        "  - project",
        "---",
        "",
        "Free note body."
      ].join("\n")
    );

    expect(root).toMatchObject({
      title: "free-note",
      body: "Free note body.",
      preface: [
        "---",
        "description: |",
        "  ---",
        "  # This is still YAML string content",
        "tags:",
        "  - project",
        "---"
      ].join("\n"),
      children: []
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "---",
        "description: |",
        "  ---",
        "  # This is still YAML string content",
        "tags:",
        "  - project",
        "---",
        "",
        "Free note body.",
        ""
      ].join("\n")
    );
  });

  it("serializes mind map nodes into plain Markdown headings and bodies", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product plan",
        "",
        "Root body.",
        "",
        "## Goal",
        "",
        "- Supports headings and body",
        "",
        "### Subgoal",
        "",
        "Subgoal body."
      ].join("\n")
    );

    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# Product plan",
        "",
        "Root body.",
        "",
        "## Goal",
        "",
        "- Supports headings and body",
        "",
        "### Subgoal",
        "",
        "Subgoal body.",
        ""
      ].join("\n")
    );
  });

  it("persists Markdown file nodes as Obsidian link headings", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product plan",
        "",
        "## [[notes/project.md|project]]",
        "",
        "File node note."
      ].join("\n")
    );

    expect(findByTitle(root, "project")).toMatchObject({
      type: "file",
      title: "project",
      body: "File node note.",
      filePath: "notes/project.md",
      outlineExpanded: false
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# Product plan",
        "",
        "## [[notes/project.md|project]]",
        "",
        "File node note.",
        ""
      ].join("\n")
    );
  });

  it("recognizes Obsidian file link headings without a .md extension", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product plan",
        "",
        "## [[notes/project|project]]"
      ].join("\n")
    );

    expect(findByTitle(root, "project")).toMatchObject({
      type: "file",
      title: "project",
      filePath: "notes/project.md"
    });
  });

  it("recognizes Obsidian file link headings with heading or block-reference subpaths", () => {
    const headingLinkRoot = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product plan", "", "## [[notes/project#Goal|project]]"].join("\n")
    );
    const blockLinkRoot = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product plan", "", "## [[notes/tasks^abc123|tasks]]"].join("\n")
    );

    expect(findByTitle(headingLinkRoot, "project")).toMatchObject({
      type: "file",
      title: "project",
      filePath: "notes/project.md"
    });
    expect(findByTitle(blockLinkRoot, "tasks")).toMatchObject({
      type: "file",
      title: "tasks",
      filePath: "notes/tasks.md"
    });
    expect(serializeMindmapMarkdown(headingLinkRoot)).toBe(
      ["# Product plan", "", "## [[notes/project.md|project]]", ""].join("\n")
    );
  });

  it("in-file heading links are not treated as Markdown file nodes", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product plan", "", "## [[#Goal|Goal]]"].join("\n")
    );

    expect(findByTitle(root, "[[#Goal|Goal]]")).toMatchObject({
      type: "heading",
      title: "[[#Goal|Goal]]",
      filePath: "projects/map.md"
    });
    expect(serializeMindmapMarkdown(root)).toBe(
      ["# Product plan", "", "## [[#Goal|Goal]]", ""].join("\n")
    );
  });

  it("file nodes always show the target Markdown file name rather than the link alias", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product plan",
        "",
        "## [[notes/project.md|Custom alias]]"
      ].join("\n")
    );

    expect(findByTitle(root, "project")).toMatchObject({
      type: "file",
      title: "project",
      filePath: "notes/project.md"
    });
  });

  it("file nodes are always written back with the target file name as the Obsidian link alias", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product plan",
        "",
        "## [[notes/project.md|project]]"
      ].join("\n")
    );
    findByTitle(root, "project").title = "Bad alias";

    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# Product plan",
        "",
        "## [[notes/project.md|project]]",
        ""
      ].join("\n")
    );
  });

  it("serializing does not write a file node's auto-expanded outline into the mind map Markdown", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product plan",
        "",
        "## [[notes/project.md|project]]"
      ].join("\n")
    );
    const fileNode = findByTitle(root, "project");
    fileNode.outlineExpanded = true;
    fileNode.children = buildOutlineTree("notes/project.md", [
      { heading: "External file title", level: 1 },
      { heading: "External file subheading", level: 2 }
    ]);

    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# Product plan",
        "",
        "## [[notes/project.md|project]]",
        ""
      ].join("\n")
    );
  });

  it("reads legacy HTML-comment collapsed state but no longer writes plugin comments when serializing", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product plan",
        "",
        "<!-- outline-mindmap: collapsed=true -->",
        "",
        "Root body.",
        "",
        "## Goal",
        "",
        "<!-- outline-mindmap: collapsed=true -->",
        "",
        "Goal body."
      ].join("\n")
    );

    const heading = root.children[0];
    expect(heading.bodyCollapsed).toBe(true);
    expect(heading.body).toBe("Root body.");
    expect(heading.children[0].bodyCollapsed).toBe(true);
    expect(heading.children[0].body).toBe("Goal body.");
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "# Product plan",
        "",
        "Root body.",
        "",
        "## Goal",
        "",
        "Goal body.",
        ""
      ].join("\n")
    );
  });

  it("keeps YAML frontmatter and pre-heading text at the top of the file instead of merging them into the root body", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "---",
        "tags:",
        "  - project",
        "---",
        "",
        "Pre-heading text.",
        "",
        "# Product plan",
        "",
        "Root body."
      ].join("\n")
    );

    expect(root.body).toBe("Pre-heading text.");
    expect(root.children[0].body).toBe("Root body.");
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "---",
        "tags:",
        "  - project",
        "---",
        "",
        "Pre-heading text.",
        "",
        "# Product plan",
        "",
        "Root body.",
        ""
      ].join("\n")
    );
  });

  it("# lines inside YAML frontmatter are not parsed as Markdown headings", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "---",
        "# frontmatter comment",
        "title: Project",
        "---",
        "",
        "# Product plan",
        "",
        "Root body."
      ].join("\n")
    );

    expect(root.children[0].title).toBe("Product plan");
    expect(root.preface).toBe(["---", "# frontmatter comment", "title: Project", "---"].join("\n"));
    expect(serializeMindmapMarkdown(root)).toBe(
      [
        "---",
        "# frontmatter comment",
        "title: Project",
        "---",
        "",
        "# Product plan",
        "",
        "Root body.",
        ""
      ].join("\n")
    );
  });

  it("does not treat the whole document as frontmatter when a leading Markdown rule has no closing YAML delimiter", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["---", "", "# Product plan", "", "Root body."].join("\n")
    );

    expect(root.children[0].title).toBe("Product plan");
    expect(root.preface).toBe("");
    expect(root.body).toBe("---");
    expect(root.children[0].body).toBe("Root body.");
    expect(serializeMindmapMarkdown(root)).toBe(
      ["---", "", "# Product plan", "", "Root body.", ""].join("\n")
    );
  });

  it("keeps parsing normal headings that appear after an unclosed YAML frontmatter", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["---", "title: unclosed", "", "# Product plan", "", "Root body."].join("\n")
    );

    expect(root.children[0].title).toBe("Product plan");
    expect(root.preface).toBe("");
    expect(root.body).toBe(["---", "title: unclosed"].join("\n"));
    expect(root.children[0].body).toBe("Root body.");
    expect(serializeMindmapMarkdown(root)).toBe(
      ["---", "title: unclosed", "", "# Product plan", "", "Root body.", ""].join("\n")
    );
  });

  it("does not retroactively treat content as YAML when body text follows the first rule, even if another rule comes later", () => {
    const markdown = [
      "---",
      "",
      "# Product plan",
      "",
      "Root body.",
      "",
      "---",
      "",
      "Later body."
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown);

    expect(root.children[0].title).toBe("Product plan");
    expect(root.preface).toBe("");
    expect(root.body).toBe("---");
    expect(root.children[0].body).toBe(["Root body.", "", "---", "", "Later body."].join("\n"));
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("does not expand body list items into mind map child nodes by default", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      [
        "# Product plan",
        "",
        "- Goal one",
        "- Goal two"
      ].join("\n")
    );

    const heading = root.children[0];
    expect(heading.children).toEqual([]);
    expect(heading.body).toBe("- Goal one\n- Goal two");
  });

  it("with list-item expansion on, shows body list items as read-only child nodes without rewriting Markdown", () => {
    const markdown = [
      "# Product plan",
      "",
      "- Goal one",
      "  - Subgoal",
      "- Goal two"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([
      {
        type: "list-item",
        title: "Goal one",
        children: [{ type: "list-item", title: "Subgoal" }]
      },
      {
        type: "list-item",
        title: "Goal two"
      }
    ]);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("with list-item expansion on, also shows ordered list items as read-only child nodes", () => {
    const markdown = [
      "# Product plan",
      "",
      "1. Phase one",
      "   1. Subtask",
      "2. Phase two"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([
      {
        type: "list-item",
        title: "Phase one",
        children: [{ type: "list-item", title: "Subtask" }]
      },
      {
        type: "list-item",
        title: "Phase two"
      }
    ]);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("with list-item expansion on, keeps nested list items indented by four spaces", () => {
    const markdown = [
      "# Product plan",
      "",
      "- Phase one",
      "    - Subtask"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([
      {
        type: "list-item",
        title: "Phase one",
        children: [{ type: "list-item", title: "Subtask" }]
      }
    ]);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("with list-item expansion on, task list item titles omit the checkbox marker", () => {
    const markdown = [
      "# Product plan",
      "",
      "- [ ] Incomplete task",
      "- [x] Completed task"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([
      { type: "list-item", title: "Incomplete task" },
      { type: "list-item", title: "Completed task" }
    ]);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("with list-item expansion on, ignores list syntax inside code blocks", () => {
    const markdown = [
      "# Product plan",
      "",
      "```",
      "- Fake list in code",
      "```",
      "",
      "- Real list"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "Real list" }]);
    expect(root.children[0].children).toHaveLength(1);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("with list-item expansion on, ignores list syntax inside a long fence by fence marker and length", () => {
    const markdown = [
      "# Product plan",
      "",
      "~~~~",
      "~~~",
      "- Fake list in code",
      "~~~",
      "~~~~",
      "",
      "- Real list"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "Real list" }]);
    expect(root.children[0].children).toHaveLength(1);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("with list-item expansion on, still ignores lists in a code block whose closing fence has trailing non-whitespace text", () => {
    const markdown = [
      "# Product plan",
      "",
      "```",
      "```not-close",
      "- Fake list in code",
      "```",
      "",
      "- Real list"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "Real list" }]);
    expect(root.children[0].children).toHaveLength(1);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("with list-item expansion on, ignores list syntax inside indented code blocks", () => {
    const markdown = [
      "# Product plan",
      "",
      "    - Fake list in code",
      "",
      "- Real list"
    ].join("\n");
    const root = parseMindmapMarkdown("projects/map.md", markdown, {
      expandListItems: true
    });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "Real list" }]);
    expect(root.children[0].children).toHaveLength(1);
    expect(serializeMindmapMarkdown(root)).toBe(`${markdown}\n`);
  });

  it("applying list-item expansion repeatedly does not create duplicate virtual nodes", () => {
    const root = parseMindmapMarkdown(
      "projects/map.md",
      ["# Product plan", "", "- Goal one"].join("\n")
    );

    applyListItemExpansion(root, { expandListItems: true });
    applyListItemExpansion(root, { expandListItems: true });

    expect(root.children[0].children).toMatchObject([{ type: "list-item", title: "Goal one" }]);
    expect(root.children[0].children).toHaveLength(1);
  });
});

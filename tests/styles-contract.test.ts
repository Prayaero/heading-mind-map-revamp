import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("styles.css", "utf8");

describe("styles contract", () => {
  it("the mind map canvas and embedded body pane share the mind map leaf", () => {
    const canvasRule = /\.hmr-canvas\s*\{([^}]+)\}/.exec(css)?.[1] ?? "";
    expect(canvasRule).toContain("flex: 1 1 0");
    expect(canvasRule).toContain("min-height: 0");
    expect(css).toContain(".hmr-body");
  });

  it("lays the canvas and body pane out side by side with a resizable divider", () => {
    const splitRule = /\.hmr-split\s*\{([^}]+)\}/.exec(css)?.[1] ?? "";
    const bodyRule = /^\.hmr-body\s*\{([^}]+)\}/m.exec(css)?.[1] ?? "";
    expect(splitRule).toContain("flex-direction: row");
    expect(bodyRule).toContain("flex: 0 0 var(--hmr-body-width)");
    expect(css).toContain(".hmr-divider");
    expect(css).toContain("cursor: col-resize");
  });

  it("the plugin doesn't override Obsidian Markdown editing or reading typography", () => {
    expect(css).not.toMatch(/\.markdown-(preview-view|rendered|source-view)\s+(h1|h2|h3|p|ul|ol|blockquote|pre|code)\b/);
  });

  it("hides the title and Properties panel in the Obsidian editor tab", () => {
    const rule = /\.hmr-note-leaf\.hmr-note-leaf \.inline-title[^{]*\{([^}]+)\}/.exec(css);
    expect(rule?.[0]).toContain('[class*="metadata-container"]');
    expect(rule?.[0]).toContain(".view-header-title-container");
    expect(rule?.[1]).toContain("display: none");
  });

  it("does not rely on !important", () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain("!important");
  });
});

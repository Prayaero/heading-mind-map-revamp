import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viewModuleFiles = [
  "src/mindmap-view.ts",
  "src/mindmap-view-actions.ts",
  "src/mindmap-view-loader.ts",
  "src/mindmap-view-persistence.ts",
  "src/mindmap-view-renderer.ts",
  "src/mindmap-view-store.ts",
  "src/mindmap-canvas-dom.ts",
  "src/mindmap-node-display.ts",
  "src/mindmap-node-measurer.ts",
  "src/mindmap-viewport-runtime.ts",
  "src/mindmap-toolbar-dom.ts",
  "src/native-markdown-pane.ts",
  "src/section-preview-view.ts",
  "src/embedded-editor-extensions.ts",
  "src/live-preview.ts",
  "src/canvas-pan.ts",
  "src/node-drag.ts",
  "src/native-editor-leaf.ts",
  "src/settings-tab.ts"
];

const viewSource = readFileSync("src/mindmap-view.ts", "utf8");
const rendererSource = readFileSync("src/mindmap-view-renderer.ts", "utf8");
const nativePaneSource = readFileSync("src/native-markdown-pane.ts", "utf8");
const sectionPreviewSource = readFileSync("src/section-preview-view.ts", "utf8");
const editorExtensionsSource = readFileSync("src/embedded-editor-extensions.ts", "utf8");
const toolbarDomSource = readFileSync("src/mindmap-toolbar-dom.ts", "utf8");
const canvasDomSource = readFileSync("src/mindmap-canvas-dom.ts", "utf8");

describe("view source contract", () => {
  it("view modules keep small, clear responsibilities", () => {
    for (const file of viewModuleFiles) {
      expect(readFileSync(file, "utf8").split(/\r?\n/).length).toBeLessThanOrEqual(300);
    }
    expect(viewSource).toContain("MindmapViewRenderer");
    expect(viewSource).not.toContain("MarkdownRenderer");
  });

  it("mind map nodes render only the title and type marker", () => {
    expect(canvasDomSource).toContain("function renderMindmapNode");
    expect(canvasDomSource).not.toContain("ButtonComponent");
    expect(canvasDomSource).not.toContain("node.body");
    expect(canvasDomSource).toContain("node.title");
    expect(canvasDomSource).toContain("getSelectedNodeId");
  });

  it("body preview and editing are both embedded in the mind map", () => {
    expect(nativePaneSource).not.toContain("MarkdownView");
    expect(nativePaneSource).not.toContain("createLeafBySplit");
    expect(nativePaneSource).not.toContain("openFile");
    expect(rendererSource).toContain("nativeMarkdownPane.reveal");
    expect(rendererSource).toContain("getNativeMarkdownPosition");
    expect(rendererSource).toContain("getSelectedNode()");
    expect(sectionPreviewSource).toContain("MarkdownRenderer.render");
    expect(sectionPreviewSource).toContain("markdown.slice(projection.from, projection.to)");
    expect(sectionPreviewSource).toContain("new EditorView");
    expect(sectionPreviewSource).toContain("vault.process");
    expect(editorExtensionsSource).toContain("markdown({ base: markdownLanguage })");
    expect(editorExtensionsSource).toContain("bracketMatching()");
    expect(editorExtensionsSource).toContain("highlightActiveLine()");
    expect(editorExtensionsSource).toContain("livePreview");
    expect(sectionPreviewSource).toContain('key: "Mod-Enter"');
    expect(nativePaneSource).toContain("setPreviewHost");
    expect(rendererSource).toContain("hmr-body");
    expect(rendererSource).not.toContain("MarkdownRenderer");
    expect(rendererSource).not.toContain("createBodyEditor");
  });

  it("the toolbar keeps hosting mind-map-level actions", () => {
    expect(toolbarDomSource).toContain("hmr-zoom-controls");
    expect(toolbarDomSource).toContain("onShowShortcutHelp");
    expect(rendererSource).toContain("onAddFileNode");
  });
});

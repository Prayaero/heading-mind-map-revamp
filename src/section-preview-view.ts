import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { Component, MarkdownRenderer, Notice, TFile, setIcon, type App } from "obsidian";
import { embeddedEditorExtensions } from "./embedded-editor-extensions";
import type { MindNode } from "./mindmap-model";
import { getSectionProjection } from "./section-projection";

export interface SectionPreviewRequest {
  file: TFile;
  node: MindNode;
  positionLine: number;
  onEdit: () => void;
}

type EditSession = {
  request: SectionPreviewRequest;
  initialContent: string;
};

type EditorHostElement = HTMLElement & {
  headingMindmapEditor?: EditorView;
};

function getHeadingMarkdown(node: MindNode): string | null {
  if (node.type !== "heading" && node.type !== "file") return null;
  const level = node.headingLevel;
  if (!level || !node.title.trim()) return null;
  return `${"#".repeat(Math.min(6, Math.max(1, level)))} ${node.title.trim()}`;
}

export class SectionPreviewView {
  private host?: HTMLElement;
  private renderChild?: Component;
  private headingChild?: Component;
  private editorView?: EditorView;
  private editSession?: EditSession;
  private renderVersion = 0;

  constructor(
    private readonly app: App,
    private readonly onReturnToPreview: () => void,
    private onToggleBody?: () => void
  ) {}

  setToggleBodyHandler(handler: () => void): void {
    this.onToggleBody = handler;
  }

  setHost(host: HTMLElement): void {
    this.host = host;
    this.disposeRenderedContent();
    this.disposeHeading();
    this.destroyEditor();
    host.empty();
  }

  async render(request: SectionPreviewRequest): Promise<void> {
    const host = this.host;
    const version = ++this.renderVersion;
    if (!host) return;

    this.editSession = undefined;
    this.destroyEditor();
    const contentEl = this.renderPreviewPanel(host, request);
    try {
      const markdown = await this.app.vault.read(request.file);
      if (version !== this.renderVersion) return;
      const projection = getSectionProjection(markdown, request.node, request.positionLine);
      const content = markdown.slice(projection.from, projection.to);
      contentEl.empty();
      if (!content.trim()) {
        contentEl.createDiv({ cls: "hmr-body-empty", text: "No body text" });
        return;
      }

      const renderChild = new Component();
      renderChild.load();
      const renderedEl = contentEl.createDiv({ cls: "markdown-preview-view markdown-rendered" });
      await MarkdownRenderer.render(this.app, content, renderedEl, request.file.path, renderChild);
      if (version !== this.renderVersion) {
        renderChild.unload();
        return;
      }
      this.disposeRenderedContent();
      this.renderChild = renderChild;
    } catch {
      if (version !== this.renderVersion) return;
      contentEl.empty();
      contentEl.createDiv({ cls: "hmr-body-error", text: "Unable to read body text" });
    }
  }

  async edit(request: SectionPreviewRequest): Promise<void> {
    const host = this.host;
    const version = ++this.renderVersion;
    if (!host) return;

    this.disposeRenderedContent();
    this.destroyEditor();
    const contentEl = this.renderEditorPanel(host, request);
    try {
      const markdown = await this.app.vault.read(request.file);
      if (version !== this.renderVersion) return;
      const projection = getSectionProjection(markdown, request.node, request.positionLine);
      const content = markdown.slice(projection.from, projection.to);
      this.editSession = { request, initialContent: content };
      this.editorView = new EditorView({
        state: EditorState.create({
          doc: content,
          extensions: [
            Prec.highest(
              keymap.of([
                {
                  key: "Mod-Enter",
                  run: () => {
                    void this.saveAndPreview();
                    return true;
                  }
                }
              ])
            ),
            embeddedEditorExtensions
          ]
        }),
        parent: contentEl
      });
      (this.editorView.dom as EditorHostElement).headingMindmapEditor = this.editorView;
      this.editorView.dom.addEventListener("keydown", (event) => this.handleEditorKeydown(event));
      this.editorView.focus();
    } catch {
      if (version !== this.renderVersion) return;
      new Notice("Unable to open the body editor");
    }
  }

  focusEditor(): void {
    this.editorView?.focus();
  }

  destroy(): void {
    this.renderVersion += 1;
    this.disposeRenderedContent();
    this.disposeHeading();
    this.destroyEditor();
    this.host?.empty();
    this.host = undefined;
  }

  private renderPreviewPanel(host: HTMLElement, request: SectionPreviewRequest): HTMLElement {
    host.empty();
    const panel = host.createDiv({ cls: "hmr-body-panel" });
    const header = this.renderHeader(panel, "Body", request.node.title);
    const editButton = this.createIconButton(header, "pencil", "Edit body");
    editButton.onclick = request.onEdit;
    this.renderHeading(panel, request);
    return panel.createDiv({ cls: "hmr-body-content" });
  }

  private renderEditorPanel(
    host: HTMLElement,
    request: SectionPreviewRequest
  ): HTMLElement {
    host.empty();
    const panel = host.createDiv({ cls: "hmr-body-panel is-editing" });
    const header = this.renderHeader(panel, "Edit", request.node.title);
    const doneButton = this.createIconButton(header, "check", "Done editing");
    doneButton.onclick = () => void this.saveAndPreview();
    const cancelButton = this.createIconButton(header, "x", "Cancel editing");
    cancelButton.onclick = () => void this.cancelEditing();
    this.renderHeading(panel, request);
    return panel.createDiv({ cls: "hmr-body-content hmr-body-editor" });
  }

  /** Shows the node's own heading line (e.g. "## Goal"), which is not part of the editable body range. */
  private renderHeading(panel: HTMLElement, request: SectionPreviewRequest): void {
    this.disposeHeading();
    const headingMarkdown = getHeadingMarkdown(request.node);
    if (!headingMarkdown) return;
    const headingEl = panel.createDiv({ cls: "hmr-body-heading markdown-preview-view markdown-rendered" });
    const child = new Component();
    child.load();
    this.headingChild = child;
    void MarkdownRenderer.render(this.app, headingMarkdown, headingEl, request.file.path, child);
  }

  private renderHeader(panel: HTMLElement, label: string, title: string): HTMLElement {
    const header = panel.createDiv({ cls: "hmr-body-header" });
    header.createSpan({ cls: "hmr-body-label", text: label });
    header.createSpan({ cls: "hmr-body-title", text: title });
    return header;
  }

  private createIconButton(header: HTMLElement, icon: string, label: string): HTMLButtonElement {
    const button = header.createEl("button", {
      cls: "clickable-icon hmr-body-edit",
      attr: { "aria-label": label, type: "button" }
    });
    setIcon(button, icon);
    return button;
  }

  private handleEditorKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && (event.key === " " || event.code === "Space")) {
      event.preventDefault();
      this.onToggleBody?.();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      void this.cancelEditing();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void this.saveAndPreview();
    }
  }

  private async saveAndPreview(): Promise<void> {
    const session = this.editSession;
    const editor = this.editorView;
    if (!session || !editor) return;
    const draft = editor.state.doc.toString();
    const { file, node, positionLine } = session.request;
    let conflict = false;
    try {
      await this.app.vault.process(file, (markdown) => {
        const projection = getSectionProjection(markdown, node, positionLine);
        if (markdown.slice(projection.from, projection.to) !== session.initialContent) {
          conflict = true;
          return markdown;
        }
        return `${markdown.slice(0, projection.from)}${draft}${markdown.slice(projection.to)}`;
      });
    } catch {
      new Notice("Save failed. Check that the file is writable");
      return;
    }
    if (conflict) {
      new Notice("The body was modified externally; your current draft was kept");
      return;
    }
    this.onReturnToPreview();
    await this.render(session.request);
  }

  private async cancelEditing(): Promise<void> {
    const session = this.editSession;
    if (!session) return;
    this.onReturnToPreview();
    await this.render(session.request);
  }

  private destroyEditor(): void {
    this.editorView?.destroy();
    this.editorView = undefined;
  }

  private disposeHeading(): void {
    this.headingChild?.unload();
    this.headingChild = undefined;
  }

  private disposeRenderedContent(): void {
    this.renderChild?.unload();
    this.renderChild = undefined;
  }
}

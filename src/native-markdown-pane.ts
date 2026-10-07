import { TFile, type App, type EditorPosition, type WorkspaceLeaf } from "obsidian";
import { NativeEditorLeaf } from "./native-editor-leaf";
import type { NoteEditorMode } from "./plugin-data";
import { SectionPreviewView } from "./section-preview-view";
import type { MindNode } from "./mindmap-model";

export interface NativeMarkdownPaneOptions {
  app: App;
  /** The mind map's own leaf; needed to open the Obsidian editor tab beside it. */
  getParentLeaf?: () => WorkspaceLeaf;
  getNoteEditorMode?: () => NoteEditorMode;
  report?: (message: string) => void;
}

export class NativeMarkdownPane {
  private readonly preview: SectionPreviewView;
  private readonly nativeEditor?: NativeEditorLeaf;
  private readonly getNoteEditorMode: () => NoteEditorMode;
  private mode: "preview" | "edit" = "preview";

  constructor(options: NativeMarkdownPaneOptions) {
    this.getNoteEditorMode = options.getNoteEditorMode ?? (() => "built-in");
    if (options.getParentLeaf) {
      this.nativeEditor = new NativeEditorLeaf({
        app: options.app,
        getParentLeaf: options.getParentLeaf,
        report: options.report
      });
    }
    this.preview = new SectionPreviewView(options.app, () => {
      this.mode = "preview";
    });
  }

  setPreviewHost(host: HTMLElement, onToggleBody: () => void): void {
    this.preview.setToggleBodyHandler(onToggleBody);
    this.preview.setHost(host);
  }

  async reveal(
    file: TFile,
    node: MindNode,
    position: EditorPosition,
    options: { focus?: boolean; forcePreview?: boolean; headingOrdinal?: number | null } = {}
  ): Promise<void> {
    if (this.nativeEditor && this.getNoteEditorMode() === "obsidian") {
      await this.nativeEditor.reveal(file, node, position, {
        focus: options.focus,
        headingOrdinal: options.headingOrdinal
      });
      return;
    }
    // Back to the built-in pane: make sure no Obsidian editor tab is left behind.
    void this.nativeEditor?.close();
    if (!options.focus && (options.forcePreview || this.mode === "preview")) {
      this.mode = "preview";
      await this.preview.render({
        file,
        node,
        positionLine: position.line,
        onEdit: () => void this.showEditor(file, node, position)
      });
      return;
    }
    await this.showEditor(file, node, position);
  }

  focus(): void {
    this.preview.focusEditor();
  }

  /** Hides the Obsidian editor tab (used when the note pane is collapsed). */
  hideNativeEditor(): void {
    void this.nativeEditor?.close();
  }

  destroy(): void {
    void this.nativeEditor?.close();
    this.preview.destroy();
  }

  private async showEditor(file: TFile, node: MindNode, position: EditorPosition): Promise<void> {
    this.mode = "edit";
    await this.preview.edit({
      file,
      node,
      positionLine: position.line,
      // After saving or cancelling, the preview is rendered from this same request, so its pencil button
      // must be able to start editing again.
      onEdit: () => void this.showEditor(file, node, position)
    });
  }
}

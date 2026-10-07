import { Notice } from "obsidian";
import { MarkdownFilePickerModal } from "./markdown-file-picker-modal";
import { MindmapShortcutHelpModal } from "./mindmap-shortcut-help-modal";
import { getSelectionAfterSubtreeRemoval } from "./node-selection";
import {
  addFileChildNode,
  canEditNodeTitle,
  canMoveNodeTo,
  isReadonlyOutlineNode,
  moveNodeTo,
  READONLY_OUTLINE_MESSAGE,
  type MovePosition,
  type OperationResult
} from "./mindmap-operations";
import { dispatchMindmapShortcut } from "./mindmap-shortcut-dispatch";
import { isToggleBodyShortcut, shouldHandleDocumentShortcutTarget, shouldIgnoreMindmapShortcutTarget } from "./keyboard-shortcuts";
import { expandFileOutlineNode } from "./file-outline-runtime";
import { findNode } from "./mindmap-navigation";
import type { MindNode } from "./mindmap-model";
import type { MindmapViewStore } from "./mindmap-view-store";
import type { MindmapViewRenderer } from "./mindmap-view-renderer";
import type { MindmapViewPersistence } from "./mindmap-view-persistence";
import type { MindmapViewLoader } from "./mindmap-view-loader";

export class MindmapViewActions {
  loader?: MindmapViewLoader;

  constructor(
    private readonly store: MindmapViewStore,
    private readonly renderer: MindmapViewRenderer,
    private readonly persistence: MindmapViewPersistence,
    private readonly containerEl: HTMLElement,
    private readonly getActiveView: () => unknown
  ) {}

  handleKeydown(event: KeyboardEvent): void {
    if (isToggleBodyShortcut(event)) {
      event.preventDefault();
      this.renderer.toggleBodyCollapsed();
      return;
    }
    if (this.shouldIgnoreShortcut(event)) return;
    dispatchMindmapShortcut(event, {
      root: this.store.root,
      selectedNodeId: this.store.selectedNodeId,
      onOperation: (result, persist) => this.applyOperation(result, persist),
      onSelectNode: (nodeId) => {
        this.store.setSelectedNode(nodeId);
        this.renderer.updateSelectionView();
      },
      onFocusCanvas: () => this.renderer.focusCanvas(),
      onFocusBody: () => void this.renderer.focusBodyEditor(),
      onStartTitleEdit: () => this.startTitleEdit()
    });
  }

  handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.shouldIgnoreShortcut(event)) return;
    if (!this.shouldHandleDocumentShortcut(event)) return;
    this.handleKeydown(event);
  }

  applyOperation(result: OperationResult, persist = true): void {
    if (!result.ok) {
      new Notice(result.message);
      if (result.selectedNodeId) this.store.setSelectedNode(result.selectedNodeId);
      return;
    }
    this.store.setSelectedNode(result.selectedNodeId);
    if (result.message) new Notice(result.message);
    const viewport = this.renderer.readViewportFromDom();
    if (persist) {
      void this.persistence.saveAndRender({ focusCanvas: true, viewport });
    } else {
      void this.persistence.saveUiState(viewport)
        .then(() => this.renderer.renderPreservingViewport({ focusCanvas: true, viewport }));
    }
  }

  canDragNode(nodeId: string): boolean {
    if (this.store.titleEditingNodeId === nodeId) return false;
    const node = findNode(this.store.root, nodeId);
    return Boolean(node) && node?.type !== "document" && !isReadonlyOutlineNode(this.store.root, nodeId);
  }

  canDropNode(nodeId: string, targetId: string, position: MovePosition): boolean {
    return canMoveNodeTo(this.store.root, nodeId, targetId, position).ok;
  }

  moveNode(nodeId: string, targetId: string, position: MovePosition): void {
    this.applyOperation(moveNodeTo(this.store.root, nodeId, targetId, position));
  }

  async toggleFileOutline(node: MindNode): Promise<void> {
    if (node.outlineExpanded) {
      const viewport = this.renderer.readViewportFromDom();
      node.children = [];
      node.outlineExpanded = false;
      node.childrenCollapsed = false;
      this.store.setSelectedNode(getSelectionAfterSubtreeRemoval(this.store.root, this.store.selectedNodeId, node.id));
      await this.persistence.saveUiState(viewport);
      this.renderer.renderPreservingViewport({ focusCanvas: true, viewport });
      return;
    }

    const viewport = this.renderer.readViewportFromDom();
    const result = await expandFileOutlineNode(
      node,
      (fileNode) => this.store.plugin.resolveFileNodeTarget(fileNode, this.store.currentFile?.path ?? ""),
      (file) => this.store.plugin.app.vault.read(file)
    );
    if (!result.ok) {
      if (result.message) new Notice(result.message);
      return;
    }
    if (result.empty) new Notice("This file has no Markdown headings to expand.");
    await this.persistence.saveUiState(viewport);
    this.renderer.renderPreservingViewport({ focusCanvas: true, viewport });
  }

  toggleNodeChildrenFold(node: MindNode): void {
    const viewport = this.renderer.readViewportFromDom();
    node.childrenCollapsed = !node.childrenCollapsed;
    this.store.setSelectedNode(node.id);
    void this.persistence.saveUiState(viewport)
      .then(() => this.renderer.renderPreservingViewport({ focusCanvas: true, viewport }));
  }

  startTitleEdit(): void {
    const editable = canEditNodeTitle(this.store.root, this.store.selectedNodeId);
    if (!editable.ok) {
      new Notice(editable.message);
      return;
    }
    this.store.titleEditingNodeId = this.store.selectedNodeId;
    this.renderer.renderPreservingViewport();
  }

  async commitTitleEdit(node: MindNode, value: string, options: { focusBody?: boolean } = {}): Promise<void> {
    if (this.store.titleEditingNodeId !== node.id) return;
    this.store.titleEditingNodeId = null;
    const nextTitle = value.trim() || "Untitled node";
    if (nextTitle !== node.title) {
      node.title = nextTitle;
      await this.persistence.saveAndRender({ focusCanvas: !options.focusBody });
    } else {
      this.renderer.renderPreservingViewport({ focusCanvas: !options.focusBody });
    }
    if (options.focusBody) await this.renderer.focusBodyEditor();
  }

  openFilePicker(): void {
    if (isReadonlyOutlineNode(this.store.root, this.store.selectedNodeId)) {
      new Notice(READONLY_OUTLINE_MESSAGE);
      return;
    }
    new MarkdownFilePickerModal(this.store.plugin, this.store.currentFile?.path, (file) => {
      this.applyOperation(addFileChildNode(this.store.root, this.store.selectedNodeId, file.path));
      this.renderer.focusCanvas();
    }).open();
  }

  openShortcutHelp(): void {
    new MindmapShortcutHelpModal(this.store.plugin.app).open();
  }

  async toggleListItemExpansion(): Promise<void> {
    await this.setListItemExpansion(!this.store.plugin.getExpandListItems());
  }

  async setListItemExpansion(value: boolean): Promise<void> {
    const viewport = this.renderer.readViewportFromDom();
    await this.persistence.saveUiState(viewport);
    await this.store.plugin.setExpandListItems(value);
    await this.loader?.loadFromState({ preserveSelection: true, viewport });
    this.renderer.focusCanvas();
  }

  private shouldIgnoreShortcut(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;
    return shouldIgnoreMindmapShortcutTarget({
      isContentEditable: target.isContentEditable,
      insideSourceEditor: Boolean(target.closest(".cm-editor, .markdown-source-view")),
      isEditableElement: target.matches("input, textarea, select"),
      isInteractiveElement: target.matches("button, a[href], [role='button'], [role='link']")
    });
  }

  private shouldHandleDocumentShortcut(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;
    const activeEl = activeDocument.activeElement;
    return shouldHandleDocumentShortcutTarget({
      targetInsideView: this.containerEl.contains(target),
      targetInsideModal: Boolean(target.closest(".modal")),
      activeViewIsMindmap: this.getActiveView() !== null,
      activeElementIsPageRoot:
        activeEl === activeDocument.body ||
        activeEl === activeDocument.documentElement ||
        activeEl === null
    });
  }
}

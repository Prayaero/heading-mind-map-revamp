import { TFile, setIcon } from "obsidian";
import { findNode } from "./mindmap-navigation";
import { getNativeHeadingOrdinal, getNativeMarkdownFilePath, getNativeMarkdownPosition } from "./native-markdown-location";
import { renderMindmapCanvas } from "./mindmap-canvas-dom";
import type { MindmapNodeSizeCache } from "./mindmap-node-measurer";
import { applyBodyWidthRatio, renderSplitDivider } from "./split-divider-dom";
import { renderMindmapToolbar } from "./mindmap-toolbar-dom";
import { MindmapViewportRuntime } from "./mindmap-viewport-runtime";
import { getSurfacePointViewportCenter, preserveViewportForRender, type ViewportPoint } from "./viewport-dom";
import {
  DEFAULT_VIEWPORT_SCALE,
  VIEWPORT_SCALE_STEP,
  normalizeViewportState,
  type MindmapViewportState
} from "./mindmap-view-state";
import { normalizeBodyWidthRatio } from "./split-layout";
import type { MindmapViewActions } from "./mindmap-view-actions";
import type { MindmapViewPersistence } from "./mindmap-view-persistence";
import type { MindmapViewStore } from "./mindmap-view-store";

export class MindmapViewRenderer {
  actions?: MindmapViewActions;
  persistence?: MindmapViewPersistence;
  private readonly nodeSizeCache: MindmapNodeSizeCache = new Map();
  private readonly viewportRuntime: MindmapViewportRuntime;

  constructor(private readonly store: MindmapViewStore, private readonly containerEl: HTMLElement) {
    this.viewportRuntime = new MindmapViewportRuntime({
      store,
      containerEl,
      getViewport: () => this.readViewportFromDom(),
      onFocusCanvas: () => this.focusCanvas(),
      onScheduleSave: () => this.persistence?.scheduleUiStateSave()
    });
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("hmr-view");
    container.setAttr("tabindex", "0");
    container.onkeydown = (event: KeyboardEvent) => {
      event.stopPropagation();
      this.actions?.handleKeydown(event);
    };

    const toolbar = container.createDiv({ cls: "hmr-toolbar" });
    renderMindmapToolbar(toolbar, {
      title: this.store.currentFile?.basename ?? "Mind map",
      path: this.store.currentFile?.path ?? "Choose or create a Markdown mind map file",
      scale: this.store.viewport.scale,
      expandListItems: this.store.plugin.getExpandListItems(),
      onZoomOut: () => this.setToolbarScale(this.readViewportFromDom().scale - VIEWPORT_SCALE_STEP),
      onZoomIn: () => this.setToolbarScale(this.readViewportFromDom().scale + VIEWPORT_SCALE_STEP),
      onFitToView: () => this.viewportRuntime.fitToView(),
      onResetZoom: () => this.setToolbarScale(DEFAULT_VIEWPORT_SCALE),
      onToggleListItems: (value) => void this.actions?.setListItemExpansion(value),
      onAddFileNode: () => this.actions?.openFilePicker(),
      onShowShortcutHelp: () => this.actions?.openShortcutHelp()
    });

    const split = container.createDiv({ cls: "hmr-split" });
    split.toggleClass("is-native-editor", this.store.plugin.getNoteEditorMode() === "obsidian");
    this.store.splitEl = split;
    this.store.canvasEl = split.createDiv({ cls: "hmr-canvas" });
    this.store.surfaceEl = renderMindmapCanvas(this.store.canvasEl, {
      root: this.store.root,
      nodeSizeCache: this.nodeSizeCache,
      viewport: this.store.viewport,
      selectedNodeId: this.store.selectedNodeId,
      getSelectedNodeId: () => this.store.selectedNodeId,
      titleEditingNodeId: this.store.titleEditingNodeId,
      onKeydown: (event) => this.actions?.handleKeydown(event),
      onScroll: () => this.persistence?.scheduleUiStateSave(),
      onFocusCanvas: () => this.focusCanvas(),
      onScaleChange: (scaleDelta, center) => {
        this.viewportRuntime.setScale(this.readViewportFromDom().scale + scaleDelta, center);
      },
      getScale: () => this.readViewportFromDom().scale,
      canDragNode: (nodeId) => this.actions?.canDragNode(nodeId) ?? false,
      canDropNode: (nodeId, targetId, position) => this.actions?.canDropNode(nodeId, targetId, position) ?? false,
      onMoveNode: (nodeId, targetId, position) => this.actions?.moveNode(nodeId, targetId, position),
      onSelectNode: (nodeId) => {
        this.store.setSelectedNode(nodeId);
        this.updateSelectionView();
      },
      onToggleFileOutline: (node) => void this.actions?.toggleFileOutline(node),
      onToggleNodeChildrenFold: (node) => this.actions?.toggleNodeChildrenFold(node),
      onCommitTitleEdit: (node, value, options) => void this.actions?.commitTitleEdit(node, value, options),
      onCancelTitleEdit: () => {
        this.store.titleEditingNodeId = null;
        this.renderPreservingViewport({ focusCanvas: true });
      }
    }).surfaceEl;
    this.store.dividerEl = renderSplitDivider(split, {
      splitEl: split,
      getRatio: () => this.store.bodyWidthRatio,
      onRatioChange: (ratio) => this.setBodyWidthRatio(ratio),
      onRatioCommit: () => this.store.plugin.app.workspace.requestSaveLayout()
    });
    this.store.bodyEl = split.createDiv({ cls: "hmr-body" });
    const bodyHost = this.store.bodyEl.createDiv({ cls: "hmr-body-host" });
    this.store.bodyCollapsedTitleEl = this.store.bodyEl.createSpan({ cls: "hmr-body-collapsed-title" });
    const restoreButton = this.store.bodyEl.createEl("button", {
      cls: "clickable-icon hmr-body-restore",
      attr: { "aria-label": "Expand body pane", title: "Expand body pane", type: "button" }
    });
    setIcon(restoreButton, "chevron-left");
    restoreButton.onclick = () => this.toggleBodyCollapsed();
    this.store.nativeMarkdownPane.setPreviewHost(bodyHost, () => this.toggleBodyCollapsed());
    this.setBodyWidthRatio(this.store.bodyWidthRatio);
    this.applyBodyCollapsedState();
    void this.revealSelectedNode();
  }

  renderPreservingViewport(options: { focusCanvas?: boolean; viewport?: MindmapViewportState } = {}): void {
    this.store.viewport = preserveViewportForRender(this.store.viewport, options.viewport ?? this.readViewportFromDom());
    this.render();
    if (options.focusCanvas) window.setTimeout(() => this.focusCanvas(), 0);
  }

  handleCssChange(): void {
    this.nodeSizeCache.clear();
    this.renderPreservingViewport();
  }

  readViewportFromDom(): MindmapViewportState {
    return normalizeViewportState({
      scale: this.store.viewport.scale,
      scrollLeft: this.store.canvasEl?.scrollLeft ?? this.store.viewport.scrollLeft,
      scrollTop: this.store.canvasEl?.scrollTop ?? this.store.viewport.scrollTop
    });
  }

  focusCanvas(): void {
    this.store.canvasEl?.focus({ preventScroll: true });
  }

  updateSelectionView(): void {
    const surface = this.store.surfaceEl;
    if (!surface) return;
    surface.querySelectorAll<HTMLElement>(".hmr-node.is-selected").forEach((nodeEl) => {
      nodeEl.removeClass("is-selected");
    });
    surface.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(this.store.selectedNodeId)}"]`)?.addClass("is-selected");
    this.updateCollapsedTitle();
    void this.revealSelectedNode(true);
  }

  private setToolbarScale(scale: number): void {
    this.viewportRuntime.setScale(scale, this.getToolbarZoomCenter());
  }

  private getToolbarZoomCenter(): ViewportPoint | undefined {
    const { canvasEl, surfaceEl } = this.store;
    if (!canvasEl || !surfaceEl) return undefined;

    const selectedNode = findNode(this.store.root, this.store.selectedNodeId);
    const nodeId = selectedNode?.id ?? this.store.root.id;
    const nodeEl = surfaceEl.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
    if (!nodeEl) return undefined;

    return getSurfacePointViewportCenter({
      point: {
        x: nodeEl.offsetLeft + nodeEl.offsetWidth / 2,
        y: nodeEl.offsetTop + nodeEl.offsetHeight / 2
      },
      surfaceOffset: { x: surfaceEl.offsetLeft, y: surfaceEl.offsetTop },
      viewport: this.readViewportFromDom()
    });
  }

  async focusBodyEditor(): Promise<void> {
    const currentFilePath = this.store.currentFile?.path;
    if (!currentFilePath) return;
    const filePath = getNativeMarkdownFilePath(this.store.root, this.store.selectedNodeId, currentFilePath);
    const file = this.store.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;
    if (this.store.bodyCollapsed) {
      this.store.bodyCollapsed = false;
      this.applyBodyCollapsedState();
    }
    await this.store.nativeMarkdownPane.reveal(
      file,
      this.getSelectedNode(),
      getNativeMarkdownPosition(this.store.root, this.store.selectedNodeId),
      { focus: true, headingOrdinal: getNativeHeadingOrdinal(this.store.root, this.store.selectedNodeId) }
    );
  }

  toggleBodyCollapsed(): void {
    this.store.bodyCollapsed = !this.store.bodyCollapsed;
    this.applyBodyCollapsedState();
    this.store.plugin.app.workspace.requestSaveLayout();
    if (this.store.bodyCollapsed) this.focusCanvas();
    // With the Obsidian editor tab, collapsing closes the tab and expanding opens it again.
    if (this.store.plugin.getNoteEditorMode() === "obsidian") void this.revealSelectedNode();
  }

  /** Re-shows the selected node in the note pane without touching the canvas. */
  refreshNotePane(): void {
    void this.revealSelectedNode();
  }

  private async revealSelectedNode(forcePreview = false): Promise<void> {
    const currentFilePath = this.store.currentFile?.path;
    if (!currentFilePath) return;
    if (this.store.bodyCollapsed && this.store.plugin.getNoteEditorMode() === "obsidian") {
      this.store.nativeMarkdownPane.hideNativeEditor();
      return;
    }
    const filePath = getNativeMarkdownFilePath(this.store.root, this.store.selectedNodeId, currentFilePath);
    const file = this.store.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;
    await this.store.nativeMarkdownPane.reveal(
      file,
      this.getSelectedNode(),
      getNativeMarkdownPosition(this.store.root, this.store.selectedNodeId),
      { forcePreview, headingOrdinal: getNativeHeadingOrdinal(this.store.root, this.store.selectedNodeId) }
    );
  }

  private setBodyWidthRatio(ratio: number): void {
    this.store.bodyWidthRatio = normalizeBodyWidthRatio(ratio);
    if (this.store.bodyEl) applyBodyWidthRatio(this.store.bodyEl, this.store.dividerEl, this.store.bodyWidthRatio);
  }

  private applyBodyCollapsedState(): void {
    this.store.bodyEl?.toggleClass("is-collapsed", this.store.bodyCollapsed);
    this.store.dividerEl?.toggleClass("is-hidden", this.store.bodyCollapsed);
    this.updateCollapsedTitle();
  }

  private updateCollapsedTitle(): void {
    this.store.bodyCollapsedTitleEl?.setText(this.getSelectedNode().title);
  }

  private getSelectedNode() {
    return findNode(this.store.root, this.store.selectedNodeId) ?? this.store.root;
  }
}

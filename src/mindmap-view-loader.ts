import { Notice, TFile } from "obsidian";
import { getSelectionAfterReload } from "./node-selection";
import {
  getNodeIdByKey,
  getNodeKey,
  normalizeViewportState,
  resolveInitialViewportState,
  type MindmapViewportState
} from "./mindmap-view-state";
import { normalizeBodyWidthRatio } from "./split-layout";
import { decideMindmapStateLoadPolicy } from "./view-state-load-policy";
import { syncMindmapContent } from "./mindmap-sync";
import { findExpandedFileNode, refreshExpandedFileOutline } from "./file-outline-runtime";
import type { MindmapViewState } from "./mindmap-view-config";
import type { MindmapViewStore } from "./mindmap-view-store";
import type { MindmapViewRenderer } from "./mindmap-view-renderer";
import type { MindmapViewPersistence } from "./mindmap-view-persistence";

export class MindmapViewLoader {
  constructor(
    private readonly store: MindmapViewStore,
    private readonly renderer: MindmapViewRenderer,
    private readonly persistence: MindmapViewPersistence
  ) {}

  getState(): Record<string, unknown> {
    return {
      bodyCollapsed: this.store.bodyCollapsed,
      bodyWidthRatio: this.store.bodyWidthRatio,
      filePath: this.store.filePath,
      selectedNodeKey: getNodeKey(this.store.root, this.store.selectedNodeId) ?? this.store.selectedNodeKey,
      viewport: this.renderer.readViewportFromDom()
    } satisfies MindmapViewState;
  }

  async setState(state: MindmapViewState): Promise<void> {
    this.store.leafState = state;
    this.store.hasLeafState = true;
    this.store.filePath = state.filePath;
    this.store.bodyCollapsed = state.bodyCollapsed ?? false;
    this.store.bodyWidthRatio = normalizeBodyWidthRatio(state.bodyWidthRatio);
    this.store.viewport = normalizeViewportState(state.viewport);
    this.store.selectedNodeKey = state.selectedNodeKey;
    await this.loadFromState();
  }

  matchesFile(filePath: string): boolean {
    return this.store.filePath === filePath;
  }

  getFilePath(): string | undefined {
    return this.store.filePath;
  }

  usesExpandedFile(filePath: string): boolean {
    return findExpandedFileNode(
      this.store.root,
      filePath,
      (node) => this.store.plugin.resolveFileNodeTarget(node, this.store.currentFile?.path ?? "")
    ) !== null;
  }

  async refreshExpandedFile(file: TFile): Promise<void> {
    const refreshed = await refreshExpandedFileOutline(
      this.store.root,
      file,
      (node) => this.store.plugin.resolveFileNodeTarget(node, this.store.currentFile?.path ?? ""),
      () => this.store.plugin.app.vault.read(file)
    );
    if (refreshed) this.renderer.renderPreservingViewport();
  }

  async reloadFromDisk(): Promise<void> {
    const viewport = this.renderer.readViewportFromDom();
    if (this.store.filePath) {
      await this.store.plugin.saveMindmapState(this.store.filePath, this.store.root, viewport);
    }
    this.store.viewport = viewport;
    // Typing in the note editor changes the file on every autosave. When only text changed, update the tree in
    // place instead of rebuilding the canvas, which would also swallow a click on a node that is in progress.
    const file = this.store.currentFile;
    if (file && this.store.filePath === file.path) {
      const fresh = await this.store.plugin.readMindmapFile(file);
      if (syncMindmapContent(this.store.root, fresh)) {
        this.renderer.refreshNotePane();
        return;
      }
    }
    await this.loadFromState({ preserveSelection: true, viewport });
  }

  async loadFromState(
    options: { preserveSelection?: boolean; viewport?: Partial<MindmapViewportState> } = {}
  ): Promise<void> {
    const state = this.store.leafState;
    this.store.filePath = state.filePath;

    const policy = decideMindmapStateLoadPolicy(this.store.filePath, this.store.hasLeafState);
    if (policy === "await-state") return;
    if (policy === "activate-default") {
      await this.store.plugin.activateView();
      return;
    }

    const filePath = this.store.filePath;
    if (!filePath) return;

    const file = this.store.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      new Notice(`Mind map file not found: ${filePath}`);
      this.renderer.render();
      return;
    }

    const previousSelectedId = this.store.selectedNodeId;
    this.store.root = await this.store.plugin.readMindmapFile(file);
    this.store.currentFile = file;
    const storedState = this.store.plugin.getStoredMindmapState(filePath);
    this.store.viewport = resolveInitialViewportState(options.viewport ?? state.viewport, storedState);
    const selectedFromState = getNodeIdByKey(this.store.root, this.store.selectedNodeKey);
    this.store.setSelectedNode(
      getSelectionAfterReload(
        this.store.root,
        previousSelectedId,
        selectedFromState,
        options.preserveSelection
      )
    );
    this.renderer.render();
  }
}

import { Notice } from "obsidian";
import { getNodeKey, type MindmapViewportState } from "./mindmap-view-state";
import { preserveViewportForClose } from "./viewport-dom";
import type { MindmapViewStore } from "./mindmap-view-store";

export interface MindmapPersistenceHost {
  readViewportFromDom(): MindmapViewportState;
  renderPreservingViewport(options?: { focusCanvas?: boolean; viewport?: MindmapViewportState }): void;
}

export class MindmapViewPersistence {
  constructor(private readonly store: MindmapViewStore, private readonly host: MindmapPersistenceHost) {}

  async close(): Promise<void> {
    if (this.store.saveStateTimer !== null) {
      window.clearTimeout(this.store.saveStateTimer);
      this.store.saveStateTimer = null;
    }
    this.store.nativeMarkdownPane.destroy();
    await this.saveUiState(preserveViewportForClose(this.store.viewport, this.host.readViewportFromDom()));
  }

  async saveAndRender(options: { focusCanvas?: boolean; viewport?: MindmapViewportState } = {}): Promise<void> {
    const viewport = options.viewport ?? this.host.readViewportFromDom();
    try {
      await this.persistCurrentMindmap();
      this.host.renderPreservingViewport(options);
      await this.saveUiState(viewport);
    } catch {
      new Notice("Failed to save the mind map. Check that the file is writable.");
    }
  }

  async saveUiState(viewport = this.host.readViewportFromDom()): Promise<void> {
    if (!this.store.filePath) return;
    this.store.viewport = viewport;
    this.store.selectedNodeKey = getNodeKey(this.store.root, this.store.selectedNodeId) ?? undefined;
    this.store.plugin.app.workspace.requestSaveLayout();
    await this.store.plugin.saveMindmapState(this.store.filePath, this.store.root, this.store.viewport);
  }

  scheduleUiStateSave(): void {
    if (this.store.saveStateTimer !== null) {
      window.clearTimeout(this.store.saveStateTimer);
    }
    this.store.saveStateTimer = window.setTimeout(() => {
      this.store.saveStateTimer = null;
      void this.saveUiState();
    }, 200);
  }

  private async persistCurrentMindmap(): Promise<void> {
    if (!this.store.currentFile) return;
    const save = this.store.saveQueue.then(() => this.store.plugin.persistMindmap(this.store.currentFile!, this.store.root));
    this.store.saveQueue = save.catch(() => undefined);
    await save;
  }

}

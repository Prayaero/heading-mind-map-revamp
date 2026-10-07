import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { chooseMindmapSourcePath } from "./active-mindmap-file";
import { resolveFileNodePath } from "./file-node-target";
import { getHeadingMindmapStrings } from "./i18n";
import {
  buildOutlineTreeFromMarkdown,
  createStarterMindmap,
  getFileTitle,
  parseMindmapMarkdown,
  serializeMindmapMarkdown,
  type MindNode
} from "./mindmap-model";
import {
  applyStoredMindmapState,
  collectStoredMindmapState,
  type MindmapViewportState,
  type StoredMindmapState
} from "./mindmap-view-state";
import {
  DEFAULT_MINDMAP_PATH,
  VIEW_TYPE_MINDMAP,
  type MindmapViewState
} from "./mindmap-view-config";
import { HeadingMindmapView } from "./mindmap-view";
import { DEFAULT_NOTE_EDITOR_MODE, normalizePluginData, type HeadingMindmapPluginData, type NoteEditorMode } from "./plugin-data";
import { sectionProjectionExtension } from "./section-projection-extension";
import { HeadingMindmapSettingTab } from "./settings-tab";
import { decideMindmapOpenPolicy } from "./view-open-policy";

export default class HeadingMindmapPlugin extends Plugin {
  private data: HeadingMindmapPluginData = { files: {}, expandListItems: false, noteEditor: DEFAULT_NOTE_EDITOR_MODE, debugNotices: false };
  private persistCount = 0;

  async onload(): Promise<void> {
    this.data = normalizePluginData(await this.loadData());
    const strings = getHeadingMindmapStrings();

    this.registerEditorExtension(sectionProjectionExtension);
    this.addSettingTab(new HeadingMindmapSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_MINDMAP,
      (leaf) => new HeadingMindmapView(leaf, this)
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (this.persistCount > 0) return;
        if (file instanceof TFile) {
          void this.refreshViewsForFile(file);
        }
      })
    );

    this.addRibbonIcon("git-fork", strings.ribbon.open, () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open",
      name: strings.commands.open,
      callback: () => {
        void this.activateView();
      }
    });

    this.addCommand({
      id: "toggle-list-item-expansion",
      name: strings.commands.toggleListItemExpansion,
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(HeadingMindmapView);
        if (!view) return;
        return view.toggleListItemExpansion();
      }
    });
  }

  async activateView(): Promise<void> {
    const file = await this.getActiveOrDefaultMindmapFile();
    const activeView = this.app.workspace.getActiveViewOfType(HeadingMindmapView);
    const policy = decideMindmapOpenPolicy(activeView ? { filePath: activeView.getFilePath() } : null, file.path);
    const leaf = policy === "reuse-current-mindmap" ? activeView!.leaf : this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_MINDMAP,
      active: true,
      state: { filePath: file.path } satisfies MindmapViewState
    });
    void this.app.workspace.revealLeaf(leaf);
  }

  async readMindmapFile(file: TFile): Promise<MindNode> {
    const markdown = await this.app.vault.read(file);
    const root = parseMindmapMarkdown(file.path, markdown, {
      expandListItems: this.data.expandListItems
    });
    applyStoredMindmapState(root, this.data.files[file.path]);
    await this.restoreExpandedFileOutlines(root, file.path);
    return root;
  }

  getExpandListItems(): boolean {
    return this.data.expandListItems;
  }

  async setExpandListItems(value: boolean): Promise<void> {
    if (this.data.expandListItems === value) return;
    this.data.expandListItems = value;
    await this.saveData(this.data);
  }

  getDebugNotices(): boolean {
    return this.data.debugNotices;
  }

  async setDebugNotices(value: boolean): Promise<void> {
    this.data.debugNotices = value;
    await this.saveData(this.data);
  }

  /** Shows a short on-screen message when diagnostic messages are turned on in the settings. */
  debugNotice(message: string): void {
    if (this.data.debugNotices) new Notice(`Mindmap: ${message}`, 8000);
  }

  getNoteEditorMode(): NoteEditorMode {
    return this.data.noteEditor;
  }

  async setNoteEditorMode(mode: NoteEditorMode): Promise<void> {
    if (this.data.noteEditor === mode) return;
    this.data.noteEditor = mode;
    await this.saveData(this.data);
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MINDMAP)) {
      if (leaf.view instanceof HeadingMindmapView) leaf.view.refreshNoteEditor();
    }
  }

  async persistMindmap(file: TFile, root: MindNode): Promise<void> {
    this.persistCount += 1;
    try {
      await this.app.vault.modify(file, serializeMindmapMarkdown(root));
    } finally {
      this.persistCount -= 1;
    }
  }

  getStoredMindmapState(filePath: string): StoredMindmapState | undefined {
    return this.data.files[filePath];
  }

  async saveMindmapState(
    filePath: string,
    root: MindNode,
    viewport?: Partial<MindmapViewportState>
  ): Promise<void> {
    this.data.files[filePath] = collectStoredMindmapState(root, viewport);
    await this.saveData(this.data);
  }

  resolveFileNodeTarget(node: MindNode, sourcePath = node.filePath ?? ""): TFile | null {
    if (!node.filePath) return null;
    const resolved = this.app.metadataCache.getFirstLinkpathDest(node.filePath, sourcePath);
    const targetPath = resolveFileNodePath(node.filePath, resolved?.path);
    const target = this.app.vault.getAbstractFileByPath(targetPath);
    if (!(target instanceof TFile)) return null;
    node.filePath = target.path;
    node.title = getFileTitle(target.path);
    return target;
  }

  private async refreshViewsForFile(file: TFile): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MINDMAP);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof HeadingMindmapView && view.matchesFile(file.path)) {
        await view.reloadFromDisk();
      } else if (view instanceof HeadingMindmapView && view.usesExpandedFile(file.path)) {
        await view.refreshExpandedFile(file);
      }
    }
  }

  private async restoreExpandedFileOutlines(node: MindNode, sourcePath: string): Promise<void> {
    if (node.type === "file" && node.outlineExpanded && node.filePath) {
      const file = this.resolveFileNodeTarget(node, sourcePath);
      if (file instanceof TFile) {
        node.children = buildOutlineTreeFromMarkdown(file.path, await this.app.vault.read(file));
      } else {
        node.outlineExpanded = false;
      }
    }

    for (const child of node.children) {
      await this.restoreExpandedFileOutlines(child, sourcePath);
    }
  }

  private async getActiveOrDefaultMindmapFile(): Promise<TFile> {
    const activeMindmap = this.app.workspace.getActiveViewOfType(HeadingMindmapView);
    const activeFile = this.app.workspace.getActiveFile();
    const sourcePath = chooseMindmapSourcePath(
      activeMindmap?.getFilePath(),
      activeFile ? { path: activeFile.path, extension: activeFile.extension } : null,
      DEFAULT_MINDMAP_PATH
    );

    const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
    if (sourceFile instanceof TFile) {
      return sourceFile;
    }

    const existing = this.app.vault.getAbstractFileByPath(DEFAULT_MINDMAP_PATH);
    if (existing instanceof TFile) {
      return existing;
    }

    await this.ensureFolder("Mindmaps");
    return this.app.vault.create(
      DEFAULT_MINDMAP_PATH,
      serializeMindmapMarkdown(createStarterMindmap())
    );
  }

  private async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (await this.app.vault.adapter.exists(normalized)) return;
    await this.app.vault.createFolder(normalized);
  }
}

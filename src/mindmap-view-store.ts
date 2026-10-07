import type { TFile, WorkspaceLeaf } from "obsidian";
import { NativeMarkdownPane } from "./native-markdown-pane";
import { createStarterMindmap, type MindNode } from "./mindmap-model";
import {
  getNodeKey,
  normalizeViewportState,
  type MindmapViewportState
} from "./mindmap-view-state";
import { DEFAULT_BODY_WIDTH_RATIO } from "./split-layout";
import type { MindmapViewState } from "./mindmap-view-config";
import type HeadingMindmapPlugin from "./main";

export class MindmapViewStore {
  root: MindNode = createStarterMindmap();
  currentFile: TFile | null = null;
  selectedNodeId = this.root.id;
  canvasEl?: HTMLElement;
  surfaceEl?: HTMLElement;
  bodyEl?: HTMLElement;
  bodyCollapsedTitleEl?: HTMLElement;
  bodyCollapsed = false;
  bodyWidthRatio = DEFAULT_BODY_WIDTH_RATIO;
  splitEl?: HTMLElement;
  dividerEl?: HTMLElement;
  nativeMarkdownPane: NativeMarkdownPane;
  titleEditingNodeId: string | null = null;
  filePath?: string;
  viewport: MindmapViewportState = normalizeViewportState(undefined);
  selectedNodeKey?: string;
  saveStateTimer: number | null = null;
  saveQueue: Promise<void> = Promise.resolve();
  leafState: MindmapViewState = {};
  hasLeafState = false;

  constructor(readonly plugin: HeadingMindmapPlugin, leaf: WorkspaceLeaf) {
    this.nativeMarkdownPane = new NativeMarkdownPane({
      app: plugin.app,
      getParentLeaf: () => leaf,
      getNoteEditorMode: () => plugin.getNoteEditorMode(),
      report: (message) => plugin.debugNotice(message)
    });
  }

  setSelectedNode(nodeId: string): void {
    this.selectedNodeId = nodeId;
    this.selectedNodeKey = getNodeKey(this.root, this.selectedNodeId) ?? undefined;
  }
}

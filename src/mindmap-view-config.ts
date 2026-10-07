import type { MindmapViewportState } from "./mindmap-view-state";

export const VIEW_TYPE_MINDMAP = "heading-mind-map-revamp-view";
export const DEFAULT_MINDMAP_PATH = "Mindmaps/Untitled mind map.md";

export type MindmapViewState = {
  bodyCollapsed?: boolean;
  bodyWidthRatio?: number;
  filePath?: string;
  selectedNodeKey?: string;
  viewport?: Partial<MindmapViewportState>;
};

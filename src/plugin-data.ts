import { getStoredViewportState, type StoredMindmapState } from "./mindmap-view-state";

export type NoteEditorMode = "obsidian" | "built-in";

export const DEFAULT_NOTE_EDITOR_MODE: NoteEditorMode = "obsidian";

export type HeadingMindmapPluginData = {
  files: Record<string, StoredMindmapState>;
  expandListItems: boolean;
  noteEditor: NoteEditorMode;
  /** Show on-screen diagnostic messages about the Obsidian editor tab (for troubleshooting). */
  debugNotices: boolean;
};

export function normalizeNoteEditorMode(value: unknown): NoteEditorMode {
  return value === "obsidian" || value === "built-in" ? value : DEFAULT_NOTE_EDITOR_MODE;
}

export function normalizePluginData(value: unknown): HeadingMindmapPluginData {
  if (!value || typeof value !== "object") {
    return { files: {}, expandListItems: false, noteEditor: DEFAULT_NOTE_EDITOR_MODE, debugNotices: false };
  }

  const files = (value as Partial<HeadingMindmapPluginData>).files;
  if (!files || typeof files !== "object") {
    return {
      files: {},
      expandListItems: Boolean((value as Partial<HeadingMindmapPluginData>).expandListItems),
      noteEditor: normalizeNoteEditorMode((value as Partial<HeadingMindmapPluginData>).noteEditor),
      debugNotices: Boolean((value as Partial<HeadingMindmapPluginData>).debugNotices)
    };
  }

  return {
    expandListItems: Boolean((value as Partial<HeadingMindmapPluginData>).expandListItems),
    noteEditor: normalizeNoteEditorMode((value as Partial<HeadingMindmapPluginData>).noteEditor),
    debugNotices: Boolean((value as Partial<HeadingMindmapPluginData>).debugNotices),
    files: Object.fromEntries(
      Object.entries(files)
        .filter(([path, state]) => path && state && typeof state === "object")
        .map(([path, state]) => [
          path,
          {
            collapsedNodeKeys: Array.isArray((state as Partial<StoredMindmapState>).collapsedNodeKeys)
              ? (state as Partial<StoredMindmapState>).collapsedNodeKeys!.filter(
                  (key): key is string => typeof key === "string"
                )
              : [],
            expandedFileNodeKeys: Array.isArray((state as Partial<StoredMindmapState>).expandedFileNodeKeys)
              ? (state as Partial<StoredMindmapState>).expandedFileNodeKeys!.filter(
                  (key): key is string => typeof key === "string"
                )
              : [],
            viewport: getStoredViewportState(state)
          }
        ])
    )
  };
}

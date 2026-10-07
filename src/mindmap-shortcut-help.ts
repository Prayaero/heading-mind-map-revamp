export interface MindmapShortcutHelpItem {
  keys: string;
  action: string;
}

export const MINDMAP_SHORTCUT_HELP: readonly MindmapShortcutHelpItem[] = [
  { keys: "↑ / ↓", action: "Move to the previous or next sibling node" },
  { keys: "← / →", action: "Move to the parent or first child node" },
  { keys: "Enter", action: "Edit the selected node's title" },
  { keys: "Ctrl/Cmd + Enter", action: "Focus the body editor" },
  { keys: "Ctrl/Cmd + Space", action: "Collapse or expand the body pane" },
  { keys: "Tab", action: "Add a child node" },
  { keys: "Shift + Enter", action: "Add a sibling node" },
  { keys: "Shift + Tab", action: "Promote the current node" },
  { keys: "Alt + ↑ / ↓", action: "Reorder sibling nodes" },
  { keys: "Space", action: "Collapse or expand the current node's subtree" },
  { keys: "Delete", action: "Delete the current node" }
];

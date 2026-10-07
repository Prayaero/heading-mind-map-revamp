import { ButtonComponent, setTooltip } from "obsidian";

export interface MindmapToolbarOptions {
  title: string;
  path: string;
  scale: number;
  expandListItems: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFitToView: () => void;
  onResetZoom: () => void;
  onToggleListItems: (value: boolean) => void;
  onAddFileNode: () => void;
  onShowShortcutHelp: () => void;
}

export function renderMindmapToolbar(toolbar: HTMLElement, options: MindmapToolbarOptions): void {
  const title = toolbar.createDiv({ cls: "hmr-toolbar-title" });
  title.createSpan({ text: options.title });
  title.createEl("small", { text: options.path });

  const actions = toolbar.createDiv({ cls: "hmr-toolbar-actions" });
  const zoomControls = actions.createDiv({ cls: "hmr-zoom-controls" });
  renderToolbarButton(zoomControls, "minus", "Zoom out", options.onZoomOut);
  const zoomLabel = zoomControls.createSpan({
    text: `${Math.round(options.scale * 100)}%`,
    cls: "hmr-zoom-label"
  });
  zoomLabel.setAttr("aria-label", `Current zoom ${Math.round(options.scale * 100)}%`);
  renderToolbarButton(zoomControls, "plus", "Zoom in", options.onZoomIn);
  renderToolbarButton(zoomControls, "maximize", "Fit the whole map to the window", options.onFitToView);
  renderToolbarButton(zoomControls, "rotate-ccw", "Reset zoom to 100%", options.onResetZoom);

  const listToggleLabel = actions.createEl("label", { cls: "hmr-toolbar-toggle" });
  const listToggle = listToggleLabel.createEl("input", { type: "checkbox" });
  listToggle.checked = options.expandListItems;
  listToggle.onchange = () => {
    options.onToggleListItems(listToggle.checked);
  };
  listToggleLabel.createSpan({ text: "List items" });
  setTooltip(listToggleLabel, "Show Markdown list items from the current node's body in the mind map");

  renderToolbarButton(actions, "file-plus", "Add a Markdown file node", options.onAddFileNode);
  renderToolbarButton(actions, "keyboard", "View keyboard shortcuts", options.onShowShortcutHelp);
}

function renderToolbarButton(
  container: HTMLElement,
  icon: string,
  tooltip: string,
  onClick: () => void
): ButtonComponent {
  const button = new ButtonComponent(container)
    .setIcon(icon)
    .setTooltip(tooltip)
    .onClick(onClick);
  button.buttonEl.setAttr("aria-label", tooltip);
  return button;
}

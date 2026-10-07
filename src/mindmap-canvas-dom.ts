import type { MindNode } from "./mindmap-model";
import { isFocusBodyShortcut } from "./keyboard-shortcuts";
import { getNodeBadge } from "./mindmap-node-display";
import {
  createMindmapNodeSizeResolver,
  type MindmapNodeSizeCache
} from "./mindmap-node-measurer";
import { shouldChangeSelectedNode } from "./node-selection";
import { enableCanvasPan } from "./canvas-pan";
import { getBranchColor, getNodeAppearances, getNodeLevelClass, type NodeAppearance } from "./mindmap-appearance";
import { enableNodeDrag } from "./node-drag";
import type { MovePosition } from "./mindmap-operations";
import { layoutMindmap, type LayoutNode } from "./tree-layout";
import type { MindmapViewportState } from "./mindmap-view-state";
import { getSurfacePlacement, restoreViewportScroll, type ViewportPoint } from "./viewport-dom";

export interface MindmapCanvasRenderResult {
  surfaceEl: HTMLElement;
}

export interface MindmapCanvasOptions {
  root: MindNode;
  nodeSizeCache: MindmapNodeSizeCache;
  viewport: MindmapViewportState;
  selectedNodeId: string;
  getSelectedNodeId: () => string;
  titleEditingNodeId: string | null;
  onKeydown: (event: KeyboardEvent) => void;
  onScroll: () => void;
  onFocusCanvas: () => void;
  onScaleChange: (scaleDelta: number, center?: ViewportPoint) => void;
  onSelectNode: (nodeId: string) => void;
  onToggleFileOutline: (node: MindNode) => void;
  onToggleNodeChildrenFold: (node: MindNode) => void;
  onCommitTitleEdit: (node: MindNode, value: string, options?: { focusBody?: boolean }) => void;
  onCancelTitleEdit: () => void;
  getScale: () => number;
  canDragNode: (nodeId: string) => boolean;
  canDropNode: (nodeId: string, targetId: string, position: MovePosition) => boolean;
  onMoveNode: (nodeId: string, targetId: string, position: MovePosition) => void;
}

export function renderMindmapCanvas(canvas: HTMLElement, options: MindmapCanvasOptions): MindmapCanvasRenderResult {
  const nodeSizeMeasurer = createMindmapNodeSizeResolver(canvas, options.nodeSizeCache);
  const layout = layoutMindmap(options.root, nodeSizeMeasurer.resolve);
  nodeSizeMeasurer.destroy();
  canvas.style.setProperty("--mindmap-width", `${layout.width}px`);
  canvas.style.setProperty("--mindmap-height", `${layout.height}px`);
  canvas.tabIndex = 0;
  canvas.onkeydown = (event) => {
    event.stopPropagation();
    options.onKeydown(event);
  };
  canvas.onclick = () => {
    options.onFocusCanvas();
  };
  enableCanvasPan(canvas, (target) => {
    const nodeId = target.closest<HTMLElement>(".hmr-node")?.dataset.nodeId;
    return Boolean(nodeId && options.canDragNode(nodeId));
  });
  enableNodeDrag({
    canvas,
    getScale: options.getScale,
    canDrag: options.canDragNode,
    canDrop: options.canDropNode,
    onDrop: options.onMoveNode
  });
  canvas.onscroll = () => {
    options.onScroll();
  };
  canvas.onwheel = (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    options.onScaleChange(event.deltaY > 0 ? -0.1 : 0.1, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  const scrollArea = canvas.createDiv({ cls: "hmr-scroll-area" });
  const placement = getSurfacePlacement(
    { width: layout.width, height: layout.height },
    { width: canvas.clientWidth, height: canvas.clientHeight },
    options.viewport
  );
  scrollArea.style.width = `${placement.scrollAreaWidth}px`;
  scrollArea.style.height = `${placement.scrollAreaHeight}px`;

  const surface = scrollArea.createDiv({ cls: "hmr-surface" });
  surface.style.left = `${placement.offsetLeft}px`;
  surface.style.top = `${placement.offsetTop}px`;
  surface.style.width = `${layout.width}px`;
  surface.style.height = `${layout.height}px`;
  surface.style.transform = `scale(${options.viewport.scale})`;

  const appearances = getNodeAppearances(options.root);
  renderMindmapEdges(surface, layout, appearances);
  for (const layoutNode of layout.nodes) {
    renderMindmapNode(surface, layoutNode, options, appearances.get(layoutNode.id));
  }

  restoreViewportScroll(canvas, options.viewport);
  return { surfaceEl: surface };
}

function renderMindmapEdges(
  surface: HTMLElement,
  layout: ReturnType<typeof layoutMindmap>,
  appearances: Map<string, NodeAppearance>
): void {
  const svg = surface.createSvg("svg", {
    cls: "hmr-edges",
    attr: {
      width: String(layout.width),
      height: String(layout.height)
    }
  });

  const nodePositions = new Map(layout.nodes.map((node) => [node.id, node]));
  for (const edge of layout.edges) {
    const from = nodePositions.get(edge.from);
    const to = nodePositions.get(edge.to);
    if (!from || !to) continue;

    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;
    const midX = (startX + endX) / 2;

    const appearance = appearances.get(edge.to);
    const path = svg.createSvg("path", {
      attr: {
        d: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
        class: "hmr-edge",
        "data-depth": String(Math.min(appearance?.depth ?? 1, 3))
      }
    });
    const color = getBranchColor(appearance?.branch ?? -1);
    if (color) path.style.setProperty("--branch", color);
  }
}

function renderMindmapNode(
  surface: HTMLElement,
  layoutNode: LayoutNode,
  options: MindmapCanvasOptions,
  appearance: NodeAppearance | undefined
): void {
  const { node, x, y, width, height } = layoutNode;
  const el = surface.createDiv({
    cls: [
      "hmr-node",
      `is-${node.type}`,
      getNodeLevelClass(node),
      node.id === options.selectedNodeId ? "is-selected" : "",
      appearance?.depth === 1 ? "is-branch-head" : "",
      node.childrenCollapsed && node.children.length > 0 ? "has-collapsed-children" : ""
    ].join(" ")
  });
  const branchColor = getBranchColor(appearance?.branch ?? -1);
  if (branchColor) el.style.setProperty("--branch", branchColor);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.dataset.nodeId = node.id;
  el.tabIndex = 0;
  el.onclick = (event) => {
    event.stopPropagation();
    selectNodeFromCanvas(node.id, options);
  };
  el.ondblclick = () => {
    if (node.type === "file") {
      options.onToggleFileOutline(node);
      return;
    }
    options.onToggleNodeChildrenFold(node);
  };

  const header = el.createDiv({ cls: "hmr-node-header" });
  if (options.titleEditingNodeId === node.id) {
    renderTitleInput(header, node, options);
  } else {
    renderTitleLabel(header, node, options);
  }
  header.createSpan({ text: getNodeBadge(node), cls: "hmr-node-badge" });
}

function renderTitleInput(header: HTMLElement, node: MindNode, options: MindmapCanvasOptions): void {
  const input = header.createEl("textarea", {
    cls: "hmr-node-title-input"
  });
  input.value = node.title;
  input.onclick = (event) => event.stopPropagation();
  input.ondblclick = (event) => event.stopPropagation();
  input.onkeydown = (event) => {
    if (isFocusBodyShortcut(event)) {
      event.preventDefault();
      options.onCommitTitleEdit(node, input.value, { focusBody: true });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      options.onCommitTitleEdit(node, input.value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      options.onCancelTitleEdit();
    }
  };
  input.onblur = () => {
    options.onCommitTitleEdit(node, input.value);
  };
  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}

function renderTitleLabel(header: HTMLElement, node: MindNode, options: MindmapCanvasOptions): void {
  const titleEl = header.createSpan({ text: node.title, cls: "hmr-node-title" });
  titleEl.onclick = (event) => {
    event.stopPropagation();
    selectNodeFromCanvas(node.id, options);
  };
}

function selectNodeFromCanvas(nodeId: string, options: MindmapCanvasOptions): void {
  if (!shouldChangeSelectedNode(options.getSelectedNodeId(), nodeId)) {
    options.onFocusCanvas();
    return;
  }
  options.onSelectNode(nodeId);
  options.onFocusCanvas();
}

import { getNodeLevelClass } from "./mindmap-appearance";
import { getNodeBadge } from "./mindmap-node-display";
import type { MindNode } from "./mindmap-model";
import {
  MAX_NODE_WIDTH,
  NODE_HEIGHT,
  NODE_VERTICAL_PADDING,
  NODE_WIDTH,
  type NodeSize,
  type NodeSizeResolver
} from "./tree-layout";

const NODE_WIDTH_SAFETY_MARGIN = 12;

export type MindmapNodeSizeCache = Map<string, NodeSize>;

export function createMindmapNodeSizeResolver(
  container: HTMLElement,
  cache: MindmapNodeSizeCache
): { resolve: NodeSizeResolver; destroy: () => void } {
  const layer = container.createDiv({ cls: "hmr-node-measure-layer" });

  const resolve = (node: MindNode): NodeSize => {
    const key = getCacheKey(node);
    const cached = cache.get(key);
    if (cached) return cached;

    const measured = measureNode(layer, node);
    cache.set(key, measured);
    return measured;
  };

  return {
    resolve,
    destroy: () => layer.remove()
  };
}

function measureNode(layer: HTMLElement, node: MindNode): NodeSize {
  const element = layer.createDiv({ cls: `hmr-node hmr-node-measuring is-${node.type} ${getNodeLevelClass(node)}` });
  const header = element.createDiv({ cls: "hmr-node-header" });
  const title = header.createSpan({ cls: "hmr-node-title hmr-node-title-measuring", text: node.title });
  header.createSpan({ cls: "hmr-node-badge", text: getNodeBadge(node) });

  const naturalWidth = element.getBoundingClientRect().width;
  const width = clamp(Math.ceil(naturalWidth + NODE_WIDTH_SAFETY_MARGIN), NODE_WIDTH, MAX_NODE_WIDTH);
  element.setCssProps({ width: `${width}px` });
  title.removeClass("hmr-node-title-measuring");

  const titleHeight = title.getBoundingClientRect().height;
  const height = Math.max(NODE_HEIGHT, Math.ceil(titleHeight + NODE_VERTICAL_PADDING));
  element.remove();

  return { width, height };
}

function getCacheKey(node: MindNode): string {
  return [node.type, node.headingLevel ?? "", node.title].join("\u0000");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

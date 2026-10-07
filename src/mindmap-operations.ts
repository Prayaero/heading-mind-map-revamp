import { createFileNode, createNewHeadingNode, type MindNode } from "./mindmap-model";

export type OperationResult =
  | { ok: true; selectedNodeId: string; message?: string }
  | { ok: false; selectedNodeId?: string; message: string };

type NodeLocation = {
  node: MindNode;
  parent: MindNode | null;
  siblings: MindNode[];
  index: number;
};

const MAX_HEADING_LEVEL = 6;
const HEADING_LIMIT_MESSAGE = "Headings support at most six levels; you can't add a child under a level-6 node.";
export const READONLY_OUTLINE_MESSAGE = "This node is a read-only preview; edit it in its Markdown file or in the body pane.";
export const FILE_NODE_TITLE_MESSAGE = "A file node's title comes from the target Markdown file name.";
export const DOCUMENT_NODE_TITLE_MESSAGE = "The document root node's title comes from the current Markdown file name.";

export function addChildNode(root: MindNode, selectedNodeId: string, title = "New node"): OperationResult {
  return addNodeAsChild(root, selectedNodeId, () => createNewHeadingNode(title, ""));
}

export function addFileChildNode(root: MindNode, selectedNodeId: string, filePath: string): OperationResult {
  return addNodeAsChild(root, selectedNodeId, () => createFileNode(filePath));
}

function addNodeAsChild(
  root: MindNode,
  selectedNodeId: string,
  createNode: () => MindNode
): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "The selected node could not be found." };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }

  const childLevel = getNodeLevel(location.node) + 1;
  if (childLevel > MAX_HEADING_LEVEL) {
    return { ok: false, selectedNodeId, message: HEADING_LIMIT_MESSAGE };
  }

  const child = createNode();
  child.headingLevel = childLevel;
  location.node.children.push(child);
  location.node.childrenCollapsed = false;
  return { ok: true, selectedNodeId: child.id };
}

export function addSiblingNode(root: MindNode, selectedNodeId: string, title = "New node"): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "The selected node could not be found." };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }
  if (!location.parent) return { ok: false, selectedNodeId, message: "The document root node can't have siblings." };

  const sibling = createNewHeadingNode(title, "");
  sibling.headingLevel = getNodeLevel(location.node);
  location.siblings.splice(location.index + 1, 0, sibling);
  return { ok: true, selectedNodeId: sibling.id };
}

export function deleteNode(root: MindNode, selectedNodeId: string): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "The selected node could not be found." };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }
  if (!location.parent) return { ok: false, selectedNodeId, message: "The document root node can't be deleted." };

  const previous = findAdjacentRealSibling(location.siblings, location.index, "previous");
  const next = findAdjacentRealSibling(location.siblings, location.index, "next");
  location.siblings.splice(location.index, 1);

  return {
    ok: true,
    selectedNodeId: next?.id ?? previous?.id ?? location.parent.id
  };
}

export function moveNodeWithinSiblings(
  root: MindNode,
  selectedNodeId: string,
  direction: "up" | "down"
): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "The selected node could not be found." };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }
  if (!location.parent) return { ok: false, selectedNodeId, message: "The document root node can't be reordered." };

  const targetIndex = findAdjacentRealSiblingIndex(location.siblings, location.index, direction);
  if (targetIndex === -1) {
    return { ok: false, selectedNodeId, message: "This node is already at the edge of its siblings." };
  }

  const [node] = location.siblings.splice(location.index, 1);
  location.siblings.splice(targetIndex, 0, node);
  return { ok: true, selectedNodeId };
}

export function promoteNode(root: MindNode, selectedNodeId: string): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "The selected node could not be found." };
  if (isReadonlyOutlineNode(root, selectedNodeId)) {
    return { ok: false, selectedNodeId, message: READONLY_OUTLINE_MESSAGE };
  }
  if (!location.parent) return { ok: false, selectedNodeId, message: "The document root node can't be promoted." };

  const parentLocation = findLocation(root, location.parent.id);
  if (!parentLocation?.parent) {
    return { ok: false, selectedNodeId, message: "A level-1 node can't be promoted further." };
  }

  const [node] = location.siblings.splice(location.index, 1);
  decrementSubtreeLevel(node);
  parentLocation.siblings.splice(parentLocation.index + 1, 0, node);
  return { ok: true, selectedNodeId };
}

export type MovePosition = "before" | "after" | "child";

type MovePlan = {
  node: MindNode;
  newParent: MindNode;
  newLevel: number;
};

function planMove(root: MindNode, nodeId: string, targetId: string, position: MovePosition):
  | { ok: true; plan: MovePlan }
  | { ok: false; message: string } {
  const source = findLocation(root, nodeId);
  const target = findLocation(root, targetId);
  if (!source || !target) return { ok: false, message: "The node could not be found." };
  if (isReadonlyOutlineNode(root, nodeId) || isReadonlyOutlineNode(root, targetId)) {
    return { ok: false, message: READONLY_OUTLINE_MESSAGE };
  }
  if (!source.parent) return { ok: false, message: "The document root node can't be moved." };
  if (nodeId === targetId || containsNode(source.node, targetId)) {
    return { ok: false, message: "A node can't be moved into itself or its own subtree." };
  }
  if (position !== "child" && !target.parent) {
    return { ok: false, message: "Nodes can only be dropped onto the document root as its children." };
  }

  const newParent = position === "child" ? target.node : target.parent;
  const newLevel = position === "child" ? getNodeLevel(target.node) + 1 : getNodeLevel(target.node);
  if (!newParent) return { ok: false, message: "The node can't be moved there." };
  const shift = newLevel - getNodeLevel(source.node);
  if (getDeepestLevel(source.node) + shift > MAX_HEADING_LEVEL) {
    return { ok: false, message: "Moving this node there would exceed six heading levels." };
  }
  return { ok: true, plan: { node: source.node, newParent, newLevel } };
}

export function canMoveNodeTo(
  root: MindNode,
  nodeId: string,
  targetId: string,
  position: MovePosition
): { ok: true } | { ok: false; message: string } {
  const result = planMove(root, nodeId, targetId, position);
  return result.ok ? { ok: true } : result;
}

/** Drag-and-drop move: puts a node (with its subtree) before/after another node, or as its last child. */
export function moveNodeTo(
  root: MindNode,
  nodeId: string,
  targetId: string,
  position: MovePosition
): OperationResult {
  const planned = planMove(root, nodeId, targetId, position);
  if (!planned.ok) return { ok: false, selectedNodeId: nodeId, message: planned.message };

  const { node, newParent, newLevel } = planned.plan;
  const source = findLocation(root, nodeId);
  if (!source) return { ok: false, selectedNodeId: nodeId, message: "The node could not be found." };
  source.siblings.splice(source.index, 1);
  setSubtreeLevel(node, newLevel);

  if (position === "child") {
    newParent.children.push(node);
    newParent.childrenCollapsed = false;
  } else {
    const target = findLocation(root, targetId);
    if (!target) return { ok: false, selectedNodeId: nodeId, message: "The node could not be found." };
    target.siblings.splice(position === "before" ? target.index : target.index + 1, 0, node);
  }
  return { ok: true, selectedNodeId: nodeId };
}

function containsNode(node: MindNode, id: string): boolean {
  return node.children.some((child) => child.id === id || containsNode(child, id));
}

function getDeepestLevel(node: MindNode): number {
  return node.children.reduce((deepest, child) => Math.max(deepest, getDeepestLevel(child)), getNodeLevel(node));
}

function setSubtreeLevel(node: MindNode, level: number): void {
  const shift = level - getNodeLevel(node);
  const apply = (current: MindNode): void => {
    current.headingLevel = Math.max(1, getNodeLevel(current) + shift);
    current.children.forEach(apply);
  };
  apply(node);
}

export function toggleNodeFold(root: MindNode, selectedNodeId: string): OperationResult {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "The selected node could not be found." };

  if (location.node.children.length > 0) {
    location.node.childrenCollapsed = !location.node.childrenCollapsed;
    return { ok: true, selectedNodeId };
  }

  return { ok: false, selectedNodeId, message: "This node has no subtree to collapse." };
}

export function canEditNodeTitle(
  root: MindNode,
  selectedNodeId: string
): { ok: true } | { ok: false; message: string } {
  const location = findLocation(root, selectedNodeId);
  if (!location) return { ok: false, message: "The selected node could not be found." };
  if (isReadonlyOutlineNode(root, selectedNodeId)) return { ok: false, message: READONLY_OUTLINE_MESSAGE };
  if (location.node.type === "document") return { ok: false, message: DOCUMENT_NODE_TITLE_MESSAGE };
  if (location.node.type === "file") return { ok: false, message: FILE_NODE_TITLE_MESSAGE };
  return { ok: true };
}

function findLocation(root: MindNode, id: string): NodeLocation | null {
  if (root.id === id) {
    return { node: root, parent: null, siblings: [root], index: 0 };
  }

  const stack: Array<{ parent: MindNode; children: MindNode[] }> = [
    { parent: root, children: root.children }
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (let index = 0; index < current.children.length; index += 1) {
      const node = current.children[index];
      if (node.id === id) {
        return { node, parent: current.parent, siblings: current.children, index };
      }
      stack.push({ parent: node, children: node.children });
    }
  }

  return null;
}

function getNodeLevel(node: MindNode): number {
  if (node.type === "document") return 0;
  return node.headingLevel ?? 1;
}

function decrementSubtreeLevel(node: MindNode): void {
  node.headingLevel = Math.max(1, getNodeLevel(node) - 1);
  for (const child of node.children) {
    decrementSubtreeLevel(child);
  }
}

function findAdjacentRealSibling(
  siblings: MindNode[],
  index: number,
  direction: "previous" | "next"
): MindNode | undefined {
  const step = direction === "previous" ? -1 : 1;
  for (let current = index + step; current >= 0 && current < siblings.length; current += step) {
    if (!siblings[current].virtual) {
      return siblings[current];
    }
  }
  return undefined;
}

function findAdjacentRealSiblingIndex(
  siblings: MindNode[],
  index: number,
  direction: "up" | "down"
): number {
  const step = direction === "up" ? -1 : 1;
  for (let current = index + step; current >= 0 && current < siblings.length; current += step) {
    if (!siblings[current].virtual) {
      return current;
    }
  }
  return -1;
}

function isInsideExpandedFileOutline(root: MindNode, id: string): boolean {
  function visit(node: MindNode, insideReadonlyOutline: boolean): boolean {
    const childReadonly = insideReadonlyOutline || (node.type === "file" && Boolean(node.outlineExpanded));
    for (const child of node.children) {
      if (child.id === id) {
        return childReadonly;
      }
      if (visit(child, childReadonly)) {
        return true;
      }
    }
    return false;
  }

  return visit(root, false);
}

export function isReadonlyOutlineNode(root: MindNode, id: string): boolean {
  const node = findLocation(root, id)?.node;
  return Boolean(node?.virtual) || isInsideExpandedFileOutline(root, id);
}

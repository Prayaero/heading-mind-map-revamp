import type { EditorPosition } from "obsidian";
import type { MindNode } from "./mindmap-model";

export function getNativeMarkdownPosition(root: MindNode, selectedNodeId: string): EditorPosition {
  return findNodePosition(root, selectedNodeId) ?? { line: 0, ch: 0 };
}

export function getNativeMarkdownFilePath(root: MindNode, selectedNodeId: string, currentFilePath: string): string {
  return findNodeFilePath(root, selectedNodeId) ?? currentFilePath;
}

/**
 * Index of the node among the real headings of the current file, in document order (null for the document root,
 * virtual nodes and nodes of an expanded file outline, which belong to another file). Unlike line numbers it stays
 * valid while the open editor has unsaved edits, so the Obsidian editor tab uses it to find the section.
 */
export function getNativeHeadingOrdinal(root: MindNode, selectedNodeId: string): number | null {
  let ordinal = 0;
  let found: number | null = null;
  const visit = (node: MindNode): void => {
    if (found !== null || node.virtual) return;
    if (node.type !== "document") {
      if (node.id === selectedNodeId) {
        found = ordinal;
        return;
      }
      ordinal += 1;
    } else if (node.id === selectedNodeId) {
      return;
    }
    if (node.type === "file" && node.outlineExpanded) {
      if (containsNode(node, selectedNodeId)) found = -1;
      return;
    }
    node.children.forEach(visit);
  };
  visit(root);
  return found === null || found < 0 ? null : found;
}

function containsNode(node: MindNode, id: string): boolean {
  return node.children.some((child) => child.id === id || containsNode(child, id));
}

function findNodePosition(node: MindNode, selectedNodeId: string, inheritedLine = 0): EditorPosition | null {
  const line = node.sourceLine ?? inheritedLine;
  if (node.id === selectedNodeId) return { line, ch: 0 };
  for (const child of node.children) {
    const found = findNodePosition(child, selectedNodeId, line);
    if (found) return found;
  }
  return null;
}

function findNodeFilePath(node: MindNode, selectedNodeId: string, inheritedPath?: string): string | null {
  const filePath = node.type === "file" ? inheritedPath : node.filePath ?? inheritedPath;
  if (node.id === selectedNodeId) return filePath ?? null;
  for (const child of node.children) {
    const found = findNodeFilePath(child, selectedNodeId, filePath);
    if (found) return found;
  }
  return null;
}

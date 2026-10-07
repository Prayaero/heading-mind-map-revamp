import type { MindNode } from "./mindmap-model";

/** Obsidian's theme colors, so the map follows the user's theme and light/dark mode. */
export const BRANCH_COLORS = [
  "var(--color-blue, #3b82f6)",
  "var(--color-orange, #f97316)",
  "var(--color-green, #22c55e)",
  "var(--color-purple, #a855f7)",
  "var(--color-cyan, #06b6d4)",
  "var(--color-pink, #ec4899)",
  "var(--color-yellow, #eab308)",
  "var(--color-red, #ef4444)"
];

export type NodeAppearance = {
  /** Index of the branch this node belongs to (-1 for the root and a lone top-level heading). */
  branch: number;
  /** Distance below the branching point: 0 for the root (and a lone top-level heading), 1 for a branch head. */
  depth: number;
};

/**
 * Every branch gets its own color, shared by all of its descendants and the edges leading to them. Notes usually
 * have a single H1, so when the root has exactly one child the branches start one level lower.
 */
export function getNodeAppearances(root: MindNode): Map<string, NodeAppearance> {
  const result = new Map<string, NodeAppearance>();
  const anchor = root.children.length === 1 ? root.children[0] : root;
  const visit = (node: MindNode, branch: number, depth: number): void => {
    result.set(node.id, { branch, depth });
    node.children.forEach((child, index) => visit(child, depth === 0 ? index : branch, depth + 1));
  };
  result.set(root.id, { branch: -1, depth: 0 });
  if (anchor === root) {
    visit(root, -1, 0);
  } else {
    result.set(anchor.id, { branch: -1, depth: 0 });
    anchor.children.forEach((child, index) => visit(child, index, 1));
  }
  return result;
}

export function getBranchColor(branch: number): string | null {
  return branch < 0 ? null : BRANCH_COLORS[branch % BRANCH_COLORS.length];
}

/** The `is-level-N` class decides font size and padding, so the size measurer must use it too. */
export function getNodeLevelClass(node: MindNode): string {
  return `is-level-${node.type === "document" ? 0 : Math.min(node.headingLevel ?? 1, 4)}`;
}

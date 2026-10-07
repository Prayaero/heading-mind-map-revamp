import type { MindNode } from "./mindmap-model";

/** Whether two trees have the same shape and heading titles, i.e. differ at most in body text and line numbers. */
export function hasSameStructure(a: MindNode, b: MindNode): boolean {
  return (
    a.type === b.type &&
    a.title === b.title &&
    a.headingLevel === b.headingLevel &&
    a.filePath === b.filePath &&
    Boolean(a.virtual) === Boolean(b.virtual) &&
    Boolean(a.outlineExpanded) === Boolean(b.outlineExpanded) &&
    a.children.length === b.children.length &&
    a.children.every((child, index) => hasSameStructure(child, b.children[index]))
  );
}

/**
 * Brings the text-related fields of `target` up to date with a freshly parsed `source` of the same structure,
 * keeping the node objects (and so their ids, selection and the rendered canvas) untouched.
 */
export function copySourceContent(target: MindNode, source: MindNode): void {
  target.body = source.body;
  target.bodyCollapsed = source.bodyCollapsed;
  target.sourceLine = source.sourceLine;
  target.preface = source.preface;
  target.children.forEach((child, index) => copySourceContent(child, source.children[index]));
}

/** Returns true (after updating `target` in place) when only text changed, so no re-render is needed. */
export function syncMindmapContent(target: MindNode, source: MindNode): boolean {
  if (!hasSameStructure(target, source)) return false;
  copySourceContent(target, source);
  return true;
}

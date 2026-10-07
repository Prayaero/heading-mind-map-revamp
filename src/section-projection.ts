import type { MindNode } from "./mindmap-model";

export type SectionProjection = {
  from: number;
  to: number;
};

export type SectionProjectionNode = Pick<MindNode, "type" | "sourceLine" | "headingLevel">;

export type SectionProjectionOptions = {
  /** Also include the node's own heading line at the start of the range. */
  includeHeading?: boolean;
};

export function getSectionProjection(
  markdown: string,
  node: SectionProjectionNode,
  fallbackSourceLine = 0,
  options: SectionProjectionOptions = {}
): SectionProjection {
  const lines = markdown.split(/\r?\n/);
  const offsets = getLineOffsets(markdown);

  if (node.type === "document") {
    const firstHeading = findNextHeading(lines, 0);
    const bodyStartLine = getDocumentBodyStart(lines);
    const bodyStart = offsets[bodyStartLine] ?? markdown.length;
    const bodyEnd = firstHeading === null ? markdown.length : offsets[firstHeading] ?? markdown.length;
    return toProjection(bodyStart, bodyEnd, markdown.length);
  }

  const headingLine = node.sourceLine ?? fallbackSourceLine;
  const bodyStart = options.includeHeading
    ? offsets[Math.min(headingLine, offsets.length - 1)] ?? markdown.length
    : offsets[Math.min(headingLine + 1, offsets.length - 1)] ?? markdown.length;
  const bodyEndLine = findNextHeading(lines, headingLine + 1);
  const bodyEnd = bodyEndLine === null ? markdown.length : offsets[bodyEndLine] ?? markdown.length;
  return toProjection(bodyStart, bodyEnd, markdown.length);
}

/** 0-based line numbers of all real Markdown headings (outside code fences), in document order. */
export function listHeadingLines(markdown: string): number[] {
  const lines = markdown.split(/\r?\n/);
  const result: number[] = [];
  let fence: { marker: "`" | "~"; length: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    fence = updateFence(fence, lines[index]);
    if (!fence && /^ {0,3}#{1,6}\s+/.test(lines[index])) result.push(index);
  }
  return result;
}

function getDocumentBodyStart(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return 0;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") return index + 1;
  }
  return 0;
}

function findNextHeading(lines: string[], start: number): number | null {
  let fence: { marker: "`" | "~"; length: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    fence = updateFence(fence, lines[index]);
    if (index < start || fence) continue;
    const heading = /^ {0,3}(#{1,6})\s+/.exec(lines[index]);
    if (heading) return index;
  }
  return null;
}

function updateFence(
  current: { marker: "`" | "~"; length: number } | null,
  line: string
): { marker: "`" | "~"; length: number } | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  if (!match) return current;
  const marker = match[1][0] as "`" | "~";
  const length = match[1].length;
  if (!current) return { marker, length };
  if (current.marker === marker && length >= current.length && new RegExp(`^ {0,3}\\${marker}{${current.length},}[ \\t]*$`).test(line)) {
    return null;
  }
  return current;
}

function getLineOffsets(markdown: string): number[] {
  const offsets = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] !== "\n") continue;
    offsets.push(index + 1);
  }
  return offsets;
}

function toProjection(from: number, to: number, length: number): SectionProjection {
  const normalizedFrom = Math.min(length, Math.max(0, from));
  const normalizedTo = Math.min(length, Math.max(normalizedFrom, to));
  return { from: normalizedFrom, to: normalizedTo };
}

import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate
} from "@codemirror/view";

/**
 * A small "live preview" layer for the embedded editor: Markdown stays editable text, but headings, emphasis,
 * links, lists, quotes and so on are styled like Obsidian's editor and their syntax marks are hidden until the
 * cursor touches them.
 */

class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-lp-bullet";
    el.textContent = "•";
    return el;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean, private readonly markerPos: number) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.markerPos === this.markerPos;
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = "task-list-item-checkbox cm-lp-checkbox";
    input.onmousedown = (event) => event.preventDefault();
    input.onclick = (event) => {
      event.preventDefault();
      view.dispatch({
        changes: { from: this.markerPos + 1, to: this.markerPos + 2, insert: this.checked ? " " : "x" }
      });
    };
    return input;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class RuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-lp-hr";
    return el;
  }
}

const hidden = Decoration.replace({});
const bullet = Decoration.replace({ widget: new BulletWidget() });
const rule = Decoration.replace({ widget: new RuleWidget() });
const lineDeco = (cls: string) => Decoration.line({ class: cls });
const markDeco = (cls: string) => Decoration.mark({ class: cls });

type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]>;

type Built = { all: DecorationSet; atomic: DecorationSet };

class DecorationCollector {
  readonly ranges: Range<Decoration>[] = [];
  readonly atomic: Range<Decoration>[] = [];
  readonly fenced: Array<[number, number]> = [];

  constructor(readonly state: EditorView["state"]) {}

  touchesRange(from: number, to: number): boolean {
    return this.state.selection.ranges.some((r) => r.from <= to && r.to >= from);
  }

  touchesLine(pos: number): boolean {
    const line = this.state.doc.lineAt(pos);
    return this.touchesRange(line.from, line.to);
  }

  add(deco: Decoration, from: number, to?: number): void {
    this.ranges.push(to === undefined ? deco.range(from) : deco.range(from, to));
  }

  replace(deco: Decoration, from: number, to: number): void {
    if (to <= from) return;
    const range = deco.range(from, to);
    this.ranges.push(range);
    this.atomic.push(range);
  }

  hide(from: number, to: number): void {
    this.replace(hidden, from, to);
  }

  /** Hides a mark plus one trailing space ("## ", "> "). */
  hideMarkWithSpace(node: SyntaxNode): void {
    const end = this.state.sliceDoc(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
    this.hide(node.from, end);
  }

  eachLine(from: number, to: number, fn: (line: { from: number; to: number }) => void): void {
    for (let pos = from; pos <= to; ) {
      const line = this.state.doc.lineAt(pos);
      fn(line);
      pos = line.to + 1;
    }
  }
}

type NodeHandler = (c: DecorationCollector, node: SyntaxNode) => void;

function headingHandler(level: string): NodeHandler {
  return (c, node) => {
    c.add(lineDeco(`cm-lp-heading cm-lp-h${level}`), c.state.doc.lineAt(node.from).from);
    const mark = node.name.startsWith("ATX") ? node.getChild("HeaderMark") : null;
    if (mark && !c.touchesLine(node.from)) c.hideMarkWithSpace(mark);
  };
}

function inlineHandler(cls: string, markNames: string[]): NodeHandler {
  return (c, node) => {
    c.add(markDeco(cls), node.from, node.to);
    if (c.touchesRange(node.from, node.to)) return;
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (markNames.includes(child.name)) c.hide(child.from, child.to);
    }
  };
}

const linkHandler: NodeHandler = (c, node) => {
  const marks: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "LinkMark") marks.push(child);
  }
  if (marks.length < 2 || c.touchesRange(node.from, node.to)) return;
  c.add(markDeco("cm-lp-link"), marks[0].to, marks[1].from);
  c.hide(marks[0].from, marks[0].to);
  c.hide(marks[1].from, node.to);
};

const blockquoteHandler: NodeHandler = (c, node) => {
  c.eachLine(node.from, node.to, (line) => c.add(lineDeco("cm-lp-quote"), line.from));
};

const quoteMarkHandler: NodeHandler = (c, node) => {
  if (!c.touchesLine(node.from)) c.hideMarkWithSpace(node);
};

const listMarkHandler: NodeHandler = (c, node) => {
  if (node.parent?.parent?.name !== "BulletList") {
    c.add(markDeco("cm-lp-list-number"), node.from, node.to);
    return;
  }
  if (c.touchesLine(node.from)) return;
  const task = /^ \[([ xX])\]/.exec(c.state.sliceDoc(node.to, node.to + 4));
  if (!task) {
    c.replace(bullet, node.from, node.to);
    return;
  }
  const markerPos = node.to + 1;
  c.replace(Decoration.replace({ widget: new CheckboxWidget(task[1] !== " ", markerPos) }), node.from, markerPos + 3);
};

const ruleHandler: NodeHandler = (c, node) => {
  if (!c.touchesLine(node.from)) c.replace(rule, node.from, node.to);
};

const fencedCodeHandler: NodeHandler = (c, node) => {
  c.fenced.push([node.from, node.to]);
  c.eachLine(node.from, node.to, (line) => {
    const edge = line.from === c.state.doc.lineAt(node.from).from ? " cm-lp-codeblock-start" : line.to >= node.to ? " cm-lp-codeblock-end" : "";
    c.add(lineDeco(`cm-lp-codeblock${edge}`), line.from);
  });
};

const codeMarkHandler: NodeHandler = (c, node) => {
  if (node.parent?.name === "FencedCode") c.add(markDeco("cm-lp-codefence"), node.from, node.to);
};

const HANDLERS: Record<string, NodeHandler> = {
  StrongEmphasis: inlineHandler("cm-lp-strong", ["EmphasisMark"]),
  Emphasis: inlineHandler("cm-lp-em", ["EmphasisMark"]),
  Strikethrough: inlineHandler("cm-lp-strike", ["StrikethroughMark"]),
  InlineCode: inlineHandler("cm-lp-code", ["CodeMark"]),
  Link: linkHandler,
  Blockquote: blockquoteHandler,
  QuoteMark: quoteMarkHandler,
  ListMark: listMarkHandler,
  HorizontalRule: ruleHandler,
  FencedCode: fencedCodeHandler,
  CodeMark: codeMarkHandler,
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`ATXHeading${n}`, headingHandler(String(n))])),
  SetextHeading1: headingHandler("1"),
  SetextHeading2: headingHandler("2")
};

function build(view: EditorView): Built {
  const collector = new DecorationCollector(view.state);
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (ref) => {
        HANDLERS[ref.name]?.(collector, ref.node);
      }
    });
  }
  addTextPatterns(view, collector);
  return { all: Decoration.set(collector.ranges, true), atomic: Decoration.set(collector.atomic, true) };
}

/** Obsidian wiki links (`[[note|alias]]`) and `#tags` are not Markdown syntax, so they are matched by pattern. */
function addTextPatterns(view: EditorView, c: DecorationCollector): void {
  const isFenced = (pos: number) => c.fenced.some(([from, to]) => pos >= from && pos <= to);
  for (const { from, to } of view.visibleRanges) {
    c.eachLine(from, to, (line) => {
      if (isFenced(line.from)) return;
      const text = view.state.doc.sliceString(line.from, line.to);
      for (const match of text.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
        const start = line.from + match.index;
        const end = start + match[0].length;
        const pipe = match[1].indexOf("|");
        const labelFrom = pipe === -1 ? start + 2 : start + 2 + pipe + 1;
        c.add(markDeco("cm-lp-link"), labelFrom, end - 2);
        if (c.touchesRange(start, end)) continue;
        c.hide(start, labelFrom);
        c.hide(end - 2, end);
      }
      for (const match of text.matchAll(/(^|\s)(#[\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu)) {
        const start = line.from + match.index + match[1].length;
        c.add(markDeco("cm-lp-tag"), start, start + match[2].length);
      }
    });
  }
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    atomic: DecorationSet;

    constructor(view: EditorView) {
      ({ all: this.decorations, atomic: this.atomic } = build(view));
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged) {
        ({ all: this.decorations, atomic: this.atomic } = build(update.view));
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? Decoration.none)
  }
);

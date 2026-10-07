import { EditorState, Prec, StateEffect, StateField, Text, Transaction } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, keymap, type DecorationSet } from "@codemirror/view";
import { MarkdownView, editorInfoField } from "obsidian";
import type { SectionProjection } from "./section-projection";

type ProjectionState = {
  range: SectionProjection | null;
  decorations: DecorationSet;
};

const setSectionProjection = StateEffect.define<SectionProjection | null>();

export const setSectionProjectionEffect = setSectionProjection;

export const sectionProjectionField = StateField.define<ProjectionState>({
  create: () => ({ range: null, decorations: Decoration.none }),
  update(value, transaction) {
    let range = value.range;
    for (const effect of transaction.effects) {
      if (effect.is(setSectionProjection)) range = effect.value;
    }
    if (range && transaction.docChanged && !transaction.effects.some((effect) => effect.is(setSectionProjection))) {
      range = {
        // Text typed at either edge of the section belongs to the section; it must not slip out of view.
        from: transaction.changes.mapPos(range.from, -1),
        to: transaction.changes.mapPos(range.to, 1)
      };
    }
    return { range, decorations: createDecorations(range, transaction.state.doc) };
  },
  provide: (field) => [
    // Highest precedence so our hiding wins over Obsidian's own block widgets (e.g. the Properties panel).
    Prec.highest(EditorView.decorations.from(field, (value) => value.decorations)),
    EditorView.atomicRanges.of((view) => view.state.field(field).decorations)
  ]
});

class SectionProjectionRegistry {
  private readonly views = new Map<MarkdownView, EditorView>();
  private readonly pendingRanges = new Map<MarkdownView, SectionProjection | null>();

  attach(markdownView: MarkdownView, editorView: EditorView): void {
    this.views.set(markdownView, editorView);
    if (!this.pendingRanges.has(markdownView)) return;
    editorView.dispatch({ effects: setSectionProjection.of(this.pendingRanges.get(markdownView) ?? null) });
    this.pendingRanges.delete(markdownView);
  }

  private tryDispatch(editorView: EditorView, range: SectionProjection | null): boolean {
    try {
      editorView.dispatch({ effects: setSectionProjection.of(range) });
      return true;
    } catch (error) {
      console.warn("Heading Mind Map Revamp: could not update the section projection", error);
      return false;
    }
  }

  detach(markdownView: MarkdownView, editorView: EditorView): void {
    if (this.views.get(markdownView) === editorView) this.views.delete(markdownView);
  }

  async set(markdownView: MarkdownView, range: SectionProjection | null): Promise<boolean> {
    this.pendingRanges.set(markdownView, range);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      // Prefer the editor Obsidian is showing right now (`editor.cm`); a view remembered by our registry can be a
      // stale one that has since been replaced, and dispatching to it would silently do nothing.
      const live = (markdownView.editor as unknown as { cm?: EditorView } | undefined)?.cm;
      const candidates = [live, this.views.get(markdownView)].filter(
        (candidate, index, all): candidate is EditorView => Boolean(candidate) && all.indexOf(candidate) === index
      );
      if (candidates.some((candidate) => this.tryDispatch(candidate, range))) {
        this.pendingRanges.delete(markdownView);
        return true;
      }
      // A timer rather than requestAnimationFrame, which never fires while the window is hidden.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
    }
    return false;
  }
}

const registry = new SectionProjectionRegistry();

const registryPlugin = ViewPlugin.fromClass(
  class {
    private readonly markdownView?: MarkdownView;

    constructor(private readonly editorView: EditorView) {
      const info = editorView.state.field(editorInfoField, false);
      if (info instanceof MarkdownView) {
        this.markdownView = info;
        registry.attach(info, editorView);
      }
    }

    destroy(): void {
      if (this.markdownView) registry.detach(this.markdownView, this.editorView);
    }
  }
);

const scopedEditGuard = EditorState.transactionFilter.of((transaction) => {
  const range = transaction.startState.field(sectionProjectionField).range;
  if (!range || !transaction.docChanged || !isUserDocumentEdit(transaction)) return transaction;
  let allowed = true;
  transaction.changes.iterChanges((from, to) => {
    if (from < range.from || to > range.to) allowed = false;
  });
  return allowed ? transaction : [];
});

const selectVisibleSection = keymap.of([
  {
    key: "Mod-a",
    run: (view) => {
      const range = view.state.field(sectionProjectionField).range;
      if (!range) return false;
      view.dispatch({ selection: { anchor: range.from, head: range.to } });
      return true;
    }
  }
]);

export const sectionProjectionExtension = [sectionProjectionField, registryPlugin, scopedEditGuard, selectVisibleSection];

export async function setMarkdownSectionProjection(
  view: MarkdownView,
  range: SectionProjection | null
): Promise<boolean> {
  return registry.set(view, range);
}

/** The range the editor is currently projecting (null if none, undefined if the editor can't be inspected). */
export function getMarkdownSectionProjection(view: MarkdownView): SectionProjection | null | undefined {
  const cm = (view.editor as unknown as { cm?: EditorView } | undefined)?.cm;
  return cm?.state.field(sectionProjectionField, false)?.range;
}

/**
 * Hides everything outside the section with block replacements. The first block stops at the end of the line
 * *before* the section: if it ended exactly at the section's first character, Obsidian's line decorations for that
 * line (heading size/weight, list and quote styling) would count as being inside the replaced range and be lost.
 */
export function createDecorations(range: SectionProjection | null, doc: Text): DecorationSet {
  if (!range) return Decoration.none;
  const decorations = [];
  const hideBefore = range.from > 0 && doc.sliceString(range.from - 1, range.from) === "\n" ? range.from - 1 : range.from;
  if (hideBefore > 0) decorations.push(Decoration.replace({ block: true }).range(0, hideBefore));
  if (range.to < doc.length) decorations.push(Decoration.replace({ block: true }).range(range.to, doc.length));
  return Decoration.set(decorations, true);
}

function isUserDocumentEdit(transaction: Transaction): boolean {
  const event = transaction.annotation(Transaction.userEvent);
  return Boolean(event?.startsWith("input") || event?.startsWith("delete"));
}

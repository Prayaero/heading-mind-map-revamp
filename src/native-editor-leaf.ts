import { MarkdownView, type App, type EditorPosition, type TFile, type WorkspaceLeaf } from "obsidian";
import type { MindNode } from "./mindmap-model";
import { getSectionProjection, listHeadingLines } from "./section-projection";
import { getMarkdownSectionProjection, setMarkdownSectionProjection } from "./section-projection-extension";

export interface NativeEditorLeafOptions {
  app: App;
  /** The mind map's own leaf; the note tab is opened beside it. */
  getParentLeaf: () => WorkspaceLeaf;
  /** Optional diagnostics sink (shown on screen when the user turns diagnostic messages on). */
  report?: (message: string) => void;
}

/**
 * Shows the selected heading's section in a real Obsidian Markdown tab next to the mind map. The tab holds the
 * whole file; everything outside the section is hidden (and locked) by the section projection extension.
 */
export type RevealOptions = {
  focus?: boolean;
  /** Index of the heading among the file's real headings; preferred over line numbers, which can be stale. */
  headingOrdinal?: number | null;
};

const STEP_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} took too long`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

/** `undefined` means the editor can't be inspected; otherwise it must really be showing the requested section. */
function projectionMatches(
  applied: { from: number; to: number } | null | undefined,
  wanted: { from: number; to: number }
): boolean {
  if (applied === undefined) return true;
  return applied !== null && applied.from === wanted.from && applied.to === wanted.to;
}

function describeRange(range: { from: number; to: number } | null | undefined): string {
  if (range === undefined) return "n/a";
  return range ? `${range.from}-${range.to}` : "none";
}

function describeMode(view: MarkdownView): string {
  return `mode=${view.getMode()} source=${String((view.getState() as { source?: boolean }).source)}`;
}

export class NativeEditorLeaf {
  private leaf: WorkspaceLeaf | null = null;
  private lastTarget = "";
  private queue: Promise<void> = Promise.resolve();
  private pendingReveal: { run: () => Promise<void>; waiters: Array<() => void> } | null = null;
  private revealRunning = false;

  constructor(private readonly options: NativeEditorLeafOptions) {}

  /**
   * Reveals are coalesced: while one is running, only the most recent request is kept, so quickly clicking through
   * several nodes ends on the last one instead of replaying every step (or getting stuck behind a slow one).
   */
  reveal(file: TFile, node: MindNode, position: EditorPosition, options: RevealOptions = {}): Promise<void> {
    return new Promise<void>((resolve) => {
      const waiters = this.pendingReveal?.waiters ?? [];
      waiters.push(resolve);
      this.pendingReveal = { run: () => this.doReveal(file, node, position, options), waiters };
      if (!this.revealRunning) void this.drainReveals();
    });
  }

  private async drainReveals(): Promise<void> {
    this.revealRunning = true;
    try {
      while (this.pendingReveal) {
        const { run, waiters } = this.pendingReveal;
        this.pendingReveal = null;
        try {
          await this.enqueue(run);
        } catch (error) {
          console.error("Heading Mind Map Revamp: could not show the note editor", error);
          this.options.report?.(`ERROR ${error instanceof Error ? error.message : String(error)}`);
        }
        waiters.forEach((resolve) => resolve());
      }
    } finally {
      this.revealRunning = false;
    }
  }

  /** Closes the note tab (and lifts the projection) without forgetting how to open it again. */
  close(): Promise<void> {
    return this.enqueue(() => this.doClose());
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Shows the section, and if the note tab turns out to be unresponsive (a step times out, throws, or the editor did
   * not take the new section) throws that tab away and tries once more with a fresh one, which is what closing and
   * reopening the tab by hand does.
   */
  private async doReveal(
    file: TFile,
    node: MindNode,
    position: EditorPosition,
    options: RevealOptions
  ): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (await this.tryReveal(file, node, position, options)) return;
      this.options.report?.("the note tab did not respond; reopening it");
      await this.doClose();
    }
    console.warn("Heading Mind Map Revamp: the note editor could not show the selected section");
  }

  private async tryReveal(
    file: TFile,
    node: MindNode,
    position: EditorPosition,
    options: RevealOptions
  ): Promise<boolean> {
    try {
      const leaf = this.ensureLeaf();
      const view = await withTimeout(this.showFile(leaf, file), STEP_TIMEOUT_MS, "opening the note");
      if (!view) return false;

      const markdown = view.editor.getValue();
      const ordinal = options.headingOrdinal ?? null;
      const headingLine = ordinal === null ? undefined : listHeadingLines(markdown)[ordinal];
      const line = headingLine ?? position.line;
      const located = node.type === "document" ? node : { ...node, sourceLine: line };
      const section = getSectionProjection(markdown, located, line, { includeHeading: true });
      const body = getSectionProjection(markdown, located, line);
      const projected = await withTimeout(setMarkdownSectionProjection(view, section), STEP_TIMEOUT_MS, "hiding the rest of the note");
      const applied = getMarkdownSectionProjection(view);
      this.options.report?.(
        `${node.title || "(root)"} | heading #${ordinal ?? "-"} line ${line} | range ${section.from}-${section.to} of ${markdown.length}` +
          ` | applied=${projected} readback=${describeRange(applied)} | ${describeMode(view)}`
      );
      if (!projected || !projectionMatches(applied, section)) return false;

      const target = `${file.path}|${ordinal ?? position.line}|${node.type}`;
      this.afterProjection(leaf, view, { target, bodyStart: body.from, bodyEnd: body.to }, options);
      return true;
    } catch (error) {
      console.error("Heading Mind Map Revamp: could not show the note editor", error);
      this.options.report?.(`ERROR ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private afterProjection(
    leaf: WorkspaceLeaf,
    view: MarkdownView,
    shown: { target: string; bodyStart: number; bodyEnd: number },
    options: RevealOptions
  ): void {
    const changed = shown.target !== this.lastTarget;
    this.lastTarget = shown.target;
    // Re-projecting after our own autosave must not move the cursor or scroll position.
    if (changed || options.focus) {
      const start = view.editor.offsetToPos(Math.min(shown.bodyStart, shown.bodyEnd));
      view.editor.setCursor(start);
      view.editor.scrollIntoView({ from: start, to: start }, true);
    }
    if (options.focus) {
      this.options.app.workspace.setActiveLeaf(leaf, { focus: true });
      view.editor.focus();
    }
  }

  private async doClose(): Promise<void> {
    const leaf = this.leaf;
    this.leaf = null;
    this.lastTarget = "";
    if (!leaf || !this.isAttached(leaf)) return;
    if (leaf.view instanceof MarkdownView) await setMarkdownSectionProjection(leaf.view, null);
    leaf.detach();
  }

  private ensureLeaf(): WorkspaceLeaf {
    if (this.leaf && this.isAttached(this.leaf)) return this.leaf;
    this.lastTarget = "";
    this.leaf = this.options.app.workspace.createLeafBySplit(this.options.getParentLeaf(), "vertical");
    return this.leaf;
  }

  private prefersLivePreview(): boolean {
    const vault = this.options.app.vault as { getConfig?: (key: string) => unknown } | undefined;
    return vault?.getConfig?.("livePreview") !== false;
  }

  private isAttached(leaf: WorkspaceLeaf): boolean {
    let found = false;
    this.options.app.workspace.iterateAllLeaves((candidate) => {
      if (candidate === leaf) found = true;
    });
    return found;
  }

  private async showFile(leaf: WorkspaceLeaf, file: TFile): Promise<MarkdownView | null> {
    if (!(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== file.path) {
      this.lastTarget = "";
      // "source: false" is Obsidian's live preview; follow the user's default editing mode.
      await leaf.openFile(file, { active: false, state: { mode: "source", source: !this.prefersLivePreview() } });
    }
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return null;
    // Lets the stylesheet hide the inline title and Properties panel, which are not part of any section.
    view.containerEl?.addClass?.("hmr-note-leaf");
    // The projection only works in the editor, not in reading view.
    if (view.getMode() !== "source") await view.setState({ ...view.getState(), mode: "source" }, { history: false });
    return view;
  }
}

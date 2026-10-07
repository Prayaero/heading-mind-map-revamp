import { MarkdownView } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Extends the stub at runtime (so `instanceof MarkdownView` holds) but is typed loosely.
const BaseView = MarkdownView as unknown as new () => object;

class FakeMarkdownView extends BaseView {
  file: { path: string } | null = null;
  text = "";
  mode = "source";
  cursor: unknown = null;
  focused = false;
  editor = {
    getValue: () => this.text,
    offsetToPos: (offset: number) => ({ line: this.text.slice(0, offset).split("\n").length - 1, ch: 0 }),
    setCursor: (pos: unknown) => {
      this.cursor = pos;
    },
    scrollIntoView: vi.fn(),
    focus: () => {
      this.focused = true;
    }
  };
  getMode() {
    return this.mode;
  }
  getState() {
    return {};
  }
  setState = vi.fn(() => Promise.resolve());
}

const projections: Array<{ view: FakeMarkdownView; range: { from: number; to: number } | null }> = [];
let readback: (view: FakeMarkdownView) => { from: number; to: number } | null | undefined = () => undefined;

vi.mock("../src/section-projection-extension", () => ({
  getMarkdownSectionProjection: (view: FakeMarkdownView) => readback(view),
  setMarkdownSectionProjection: vi.fn((view: FakeMarkdownView, range: { from: number; to: number } | null) => {
    projections.push({ view, range });
    return Promise.resolve(true);
  })
}));

const { NativeEditorLeaf } = await import("../src/native-editor-leaf");
const { parseMindmapMarkdown } = await import("../src/mindmap-model");

const markdown = "# Product\n\n## Goal\n\nGoal body\n\n## Risk\n\nRisk body\n";

let livePreview = true;

function setup() {
  const files: Record<string, string> = { "note.md": markdown };
  const leaves: Array<{ view: unknown; detached: boolean; openFile: ReturnType<typeof vi.fn>; detach: () => void }> = [];
  const createLeafBySplit = vi.fn(() => {
    const leaf = {
      view: {} as unknown,
      detached: false,
      detach() {
        leaf.detached = true;
      },
      openFile: vi.fn((file: { path: string }) => {
        const view = new FakeMarkdownView();
        view.file = file;
        view.text = files[file.path];
        leaf.view = view;
        return Promise.resolve();
      })
    };
    leaves.push(leaf);
    return leaf;
  });
  const app = {
    vault: { getConfig: vi.fn((key: string) => (key === "livePreview" ? livePreview : undefined)) },
    workspace: {
      createLeafBySplit,
      iterateAllLeaves: (fn: (leaf: unknown) => void) => leaves.filter((leaf) => !leaf.detached).forEach(fn),
      setActiveLeaf: vi.fn()
    }
  };
  const parent = { id: "mindmap" };
  const pane = new NativeEditorLeaf({ app: app as never, getParentLeaf: () => parent as never });
  return { app, pane, leaves, createLeafBySplit, parent };
}

describe("native editor leaf", () => {
  beforeEach(() => {
    projections.length = 0;
    livePreview = true;
    readback = () => undefined;
  });

  it("opens one note tab beside the mind map and projects the selected heading's section including the heading", async () => {
    const { pane, leaves, createLeafBySplit, parent } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const goal = root.children[0].children[0];
    const file = { path: "note.md" } as never;

    await pane.reveal(file, goal, { line: goal.sourceLine ?? 0, ch: 0 }, { headingOrdinal: 1 });
    await pane.reveal(file, goal, { line: goal.sourceLine ?? 0, ch: 0 }, { headingOrdinal: 1 });

    expect(createLeafBySplit).toHaveBeenCalledTimes(1);
    expect(createLeafBySplit).toHaveBeenCalledWith(parent, "vertical");
    expect(leaves[0].openFile).toHaveBeenCalledTimes(1);
    const range = projections[0].range!;
    expect(markdown.slice(range.from, range.to)).toBe("## Goal\n\nGoal body\n\n");
  });

  it("finds the section by heading ordinal when the editor text has shifted from the parsed line numbers", async () => {
    const { pane, leaves } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const risk = root.children[0].children[1];
    const file = { path: "note.md" } as never;
    await pane.reveal(file, risk, { line: risk.sourceLine ?? 0, ch: 0 }, { headingOrdinal: 2 });

    // Two lines were typed above "## Risk" in the open editor but are not saved yet, so risk.sourceLine is stale.
    const view = leaves[0].view as FakeMarkdownView;
    view.text = "# Product\n\n## Goal\n\nGoal body\n\nNew line\nAnother line\n\n## Risk\n\nRisk body\n";
    await pane.reveal(file, risk, { line: risk.sourceLine ?? 0, ch: 0 }, { headingOrdinal: 2 });

    const range = projections[projections.length - 1].range!;
    expect(view.text.slice(range.from, range.to)).toBe("## Risk\n\nRisk body\n");
  });

  it("only moves the cursor when the selected node changes, and focuses the tab on request", async () => {
    const { pane, leaves, app } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const [goal, risk] = root.children[0].children;
    const file = { path: "note.md" } as never;

    await pane.reveal(file, goal, { line: goal.sourceLine ?? 0, ch: 0 }, { headingOrdinal: 1 });
    const view = leaves[0].view as FakeMarkdownView;
    expect(view.cursor).toEqual({ line: 3, ch: 0 });

    view.cursor = "untouched";
    await pane.reveal(file, goal, { line: goal.sourceLine ?? 0, ch: 0 }, { headingOrdinal: 1 });
    expect(view.cursor).toBe("untouched");

    await pane.reveal(file, risk, { line: risk.sourceLine ?? 0, ch: 0 }, { headingOrdinal: 2, focus: true });
    expect(view.cursor).toEqual({ line: 7, ch: 0 });
    expect(view.focused).toBe(true);
    expect(app.workspace.setActiveLeaf).toHaveBeenCalledWith(leaves[0], { focus: true });
  });

  it("clears the projection and closes the tab, and reopens one on the next reveal", async () => {
    const { pane, leaves, createLeafBySplit } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const goal = root.children[0].children[0];
    const file = { path: "note.md" } as never;
    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });

    await pane.close();
    expect(projections[projections.length - 1].range).toBeNull();
    expect(leaves[0].detached).toBe(true);

    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });
    expect(createLeafBySplit).toHaveBeenCalledTimes(2);
  });

  it("opens a new tab if the user closed the note tab", async () => {
    const { pane, leaves, createLeafBySplit } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const goal = root.children[0].children[0];
    const file = { path: "note.md" } as never;
    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });

    leaves[0].detach();
    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });

    expect(createLeafBySplit).toHaveBeenCalledTimes(2);
  });

  it("switches the tab back to the editor if it was put in reading view", async () => {
    const { pane, leaves } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const goal = root.children[0].children[0];
    const file = { path: "note.md" } as never;
    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });

    const view = leaves[0].view as FakeMarkdownView;
    view.mode = "preview";
    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });

    expect(view.setState).toHaveBeenCalledWith({ mode: "source" }, { history: false });
  });

  it("opens the note in live preview, or in source mode if that is the user's default editing mode", async () => {
    const root = parseMindmapMarkdown("note.md", markdown);
    const goal = root.children[0].children[0];
    const file = { path: "note.md" } as never;

    const live = setup();
    await live.pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });
    expect(live.leaves[0].openFile).toHaveBeenCalledWith(file, { active: false, state: { mode: "source", source: false } });

    livePreview = false;
    const source = setup();
    await source.pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });
    expect(source.leaves[0].openFile).toHaveBeenCalledWith(file, { active: false, state: { mode: "source", source: true } });
  });

  it("ends on the most recent node when several reveals are requested in quick succession", async () => {
    const { pane, leaves } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const [goal, risk] = root.children[0].children;
    const file = { path: "note.md" } as never;

    await Promise.all([
      pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 }),
      pane.reveal(file, risk, { line: 6, ch: 0 }, { headingOrdinal: 2 }),
      pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 }),
      pane.reveal(file, risk, { line: 6, ch: 0 }, { headingOrdinal: 2 })
    ]);

    const view = leaves[0].view as FakeMarkdownView;
    const range = projections[projections.length - 1].range!;
    expect(view.text.slice(range.from, range.to)).toBe("## Risk\n\nRisk body\n");
  });

  it("keeps working after a reveal fails", async () => {
    const { pane, leaves } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const goal = root.children[0].children[0];
    const file = { path: "note.md" } as never;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });
    (leaves[0].view as FakeMarkdownView).editor.getValue = () => {
      throw new Error("boom");
    };
    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });
    expect(error).toHaveBeenCalled();

    (leaves[0].view as FakeMarkdownView).editor.getValue = () => markdown;
    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });
    expect(projections.length).toBeGreaterThanOrEqual(2);
    error.mockRestore();
  });

  it("reopens the note tab when the editor did not take the requested section", async () => {
    const { pane, leaves, createLeafBySplit } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const goal = root.children[0].children[0];
    const file = { path: "note.md" } as never;
    const firstView = () => leaves[0]?.view;
    // The first tab ignores our projection (reads back a different range); a fresh tab behaves.
    readback = (view) => (view === firstView() ? { from: 0, to: 1 } : projections[projections.length - 1].range);

    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });

    expect(createLeafBySplit).toHaveBeenCalledTimes(2);
    expect(leaves[0].detached).toBe(true);
    expect(leaves[1].detached).toBe(false);
  });

  it("recovers when opening the note throws once", async () => {
    const { pane, leaves, createLeafBySplit } = setup();
    const root = parseMindmapMarkdown("note.md", markdown);
    const goal = root.children[0].children[0];
    const file = { path: "note.md" } as never;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createLeafBySplit.mockImplementationOnce(() => {
      const leaf = {
        view: {} as unknown,
        detached: false,
        detach() {
          leaf.detached = true;
        },
        openFile: vi.fn(() => Promise.reject(new Error("boom")))
      };
      leaves.push(leaf);
      return leaf;
    });

    await pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });

    expect(createLeafBySplit).toHaveBeenCalledTimes(2);
    expect(projections.length).toBeGreaterThan(0);
    error.mockRestore();
  });

  it("gives up on a note tab that never finishes opening and uses a fresh one", async () => {
    vi.useFakeTimers();
    try {
      const { pane, leaves, createLeafBySplit } = setup();
      const root = parseMindmapMarkdown("note.md", markdown);
      const goal = root.children[0].children[0];
      const file = { path: "note.md" } as never;
      createLeafBySplit.mockImplementationOnce(() => {
        const leaf = {
          view: {} as unknown,
          detached: false,
          detach() {
            leaf.detached = true;
          },
          openFile: vi.fn(() => new Promise<void>(() => undefined))
        };
        leaves.push(leaf);
        return leaf;
      });
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const revealed = pane.reveal(file, goal, { line: 2, ch: 0 }, { headingOrdinal: 1 });
      await vi.advanceTimersByTimeAsync(5000);
      await revealed;

      expect(createLeafBySplit).toHaveBeenCalledTimes(2);
      expect(leaves[0].detached).toBe(true);
      expect(projections.length).toBeGreaterThan(0);
      error.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});

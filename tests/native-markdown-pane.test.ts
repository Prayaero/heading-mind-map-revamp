import { describe, expect, it, vi } from "vitest";

const previewInstances: Array<{ render: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn>; returnToPreview: () => void }> = [];

vi.mock("../src/section-preview-view", () => ({
  SectionPreviewView: class {
    render = vi.fn(() => Promise.resolve());
    edit = vi.fn(() => Promise.resolve());
    setToggleBodyHandler = vi.fn();
    setHost = vi.fn();
    focusEditor = vi.fn();
    destroy = vi.fn();
    constructor(_app: unknown, public returnToPreview: () => void) {
      previewInstances.push(this);
    }
  }
}));

const { NativeMarkdownPane } = await import("../src/native-markdown-pane");
const { createTextNode } = await import("../src/mindmap-model");

describe("native markdown pane", () => {
  it("lets the pencil button start editing again after a draft was cancelled", async () => {
    const pane = new NativeMarkdownPane({ app: {} as never });
    const preview = previewInstances[previewInstances.length - 1];
    const file = { path: "note.md" } as never;
    const node = createTextNode("Goal");

    await pane.reveal(file, node, { line: 2, ch: 0 }, { focus: true });
    expect(preview.edit).toHaveBeenCalledTimes(1);

    // Cancelling returns to the preview, which is rendered from the same request that opened the editor.
    const request = preview.edit.mock.calls[0][0] as { onEdit: () => void };
    preview.returnToPreview();
    request.onEdit();
    await Promise.resolve();

    expect(preview.edit).toHaveBeenCalledTimes(2);
    expect(preview.edit.mock.calls[1][0]).toMatchObject({ file, node, positionLine: 2 });
  });

  it("opens the editor from the preview's pencil button", async () => {
    const pane = new NativeMarkdownPane({ app: {} as never });
    const preview = previewInstances[previewInstances.length - 1];
    const node = createTextNode("Goal");

    await pane.reveal({ path: "note.md" } as never, node, { line: 0, ch: 0 });
    const request = preview.render.mock.calls[0][0] as { onEdit: () => void };
    request.onEdit();
    await Promise.resolve();

    expect(preview.edit).toHaveBeenCalledTimes(1);
  });
});

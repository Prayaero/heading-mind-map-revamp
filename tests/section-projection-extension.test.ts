import { EditorState, Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { createDecorations, sectionProjectionField, setSectionProjectionEffect } from "../src/section-projection-extension";

function stateWithRange(doc: string, from: number, to: number) {
  const state = EditorState.create({ doc, extensions: [sectionProjectionField] });
  return state.update({ effects: setSectionProjectionEffect.of({ from, to }) }).state;
}

const rangeOf = (state: EditorState) => state.field(sectionProjectionField).range;

describe("section projection range tracking", () => {
  it("keeps text typed at the start of the section inside the section", () => {
    const state = stateWithRange("# A\n\n## Goal\n\nBody\n\n## Risk\n", 5, 20);
    const next = state.update({ changes: { from: 5, insert: "XX" } }).state;

    expect(rangeOf(next)).toEqual({ from: 5, to: 22 });
  });

  it("keeps text typed at the very end of the document inside the last section", () => {
    const doc = "# A\n\n## Last\n\nBody";
    const state = stateWithRange(doc, 5, doc.length);
    const next = state.update({ changes: { from: doc.length, insert: " more" } }).state;

    expect(rangeOf(next)).toEqual({ from: 5, to: doc.length + 5 });
  });

  it("shifts the range when text is edited before it and stretches it for edits inside", () => {
    const state = stateWithRange("# A\n\n## Goal\n\nBody\n\n## Risk\n", 5, 20);

    expect(rangeOf(state.update({ changes: { from: 0, insert: "ab" } }).state)).toEqual({ from: 7, to: 22 });
    expect(rangeOf(state.update({ changes: { from: 12, insert: "123" } }).state)).toEqual({ from: 5, to: 23 });
  });

  it("ends the hidden block at the end of the line before the section so the section's first line keeps its styling", () => {
    const doc = Text.of(["---", "tags: x", "---", "", "## Goal", "", "Body", "", "## Risk", "Risk body"]);
    const goalStart = doc.line(5).from;
    const riskStart = doc.line(9).from;
    const blocks: Array<[number, number]> = [];
    const cursor = createDecorations({ from: goalStart, to: riskStart }, doc).iter();
    for (; cursor.value; cursor.next()) blocks.push([cursor.from, cursor.to]);

    expect(blocks).toEqual([
      [0, goalStart - 1],
      [riskStart, doc.length]
    ]);
  });

  it("hides nothing before a section that starts the document and nothing after one that ends it", () => {
    const doc = Text.of(["## Only", "", "Body"]);
    const cursor = createDecorations({ from: 0, to: doc.length }, doc).iter();

    expect(cursor.value).toBeNull();
  });
});

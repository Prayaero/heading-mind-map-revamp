import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { drawSelection, EditorView, highlightActiveLine, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { livePreview } from "./live-preview";

const obsidianHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--text-accent)" },
  { tag: tags.link, color: "var(--link-color)" },
  { tag: tags.url, color: "var(--link-external-color)" },
  { tag: tags.monospace, color: "var(--code-normal)", fontFamily: "var(--font-monospace)" },
  { tag: tags.quote, color: "var(--text-muted)" },
  { tag: tags.meta, color: "var(--text-faint)" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" }
]);

const embeddedEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--background-primary)",
    color: "var(--text-normal)"
  },
  ".cm-activeLine": { backgroundColor: "var(--background-modifier-hover)" },
  ".cm-matchingBracket": {
    backgroundColor: "var(--background-modifier-hover)",
    color: "var(--text-accent)",
    outline: "1px solid var(--interactive-accent)"
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--text-selection)"
  },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--caret-color)" }
});

export const embeddedEditorExtensions = [
  markdown({ base: markdownLanguage }),
  livePreview,
  history(),
  drawSelection(),
  bracketMatching(),
  highlightActiveLine(),
  syntaxHighlighting(obsidianHighlightStyle),
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  embeddedEditorTheme,
  EditorView.lineWrapping
];

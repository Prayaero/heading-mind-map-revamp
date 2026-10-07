import { describe, expect, it } from "vitest";
import {
  getMindmapShortcutAction,
  isFocusBodyShortcut,
  isToggleBodyShortcut,
  shouldHandleDocumentShortcutTarget,
  shouldIgnoreMindmapShortcutTarget
} from "../src/keyboard-shortcuts";

describe("mindmap keyboard shortcuts", () => {
  it("maps keyboard input to mind map operation intents per the PRD", () => {
    expect(getMindmapShortcutAction({ key: "ArrowUp", altKey: true })).toEqual({ type: "move-sibling", direction: "up" });
    expect(getMindmapShortcutAction({ key: "ArrowDown", altKey: true })).toEqual({ type: "move-sibling", direction: "down" });
    expect(getMindmapShortcutAction({ key: "ArrowUp" })).toEqual({ type: "select", direction: "up" });
    expect(getMindmapShortcutAction({ key: "ArrowDown" })).toEqual({ type: "select", direction: "down" });
    expect(getMindmapShortcutAction({ key: "ArrowLeft" })).toEqual({ type: "select", direction: "left" });
    expect(getMindmapShortcutAction({ key: "ArrowRight" })).toEqual({ type: "select", direction: "right" });
    expect(getMindmapShortcutAction({ key: "Enter" })).toEqual({ type: "edit-title" });
    expect(getMindmapShortcutAction({ key: "Enter", ctrlKey: true })).toEqual({ type: "focus-body" });
    expect(getMindmapShortcutAction({ key: "Enter", metaKey: true })).toEqual({ type: "focus-body" });
    expect(getMindmapShortcutAction({ key: "Tab" })).toEqual({ type: "add-child" });
    expect(getMindmapShortcutAction({ key: "Enter", shiftKey: true })).toEqual({ type: "add-sibling" });
    expect(getMindmapShortcutAction({ key: "Tab", shiftKey: true })).toEqual({ type: "promote" });
    expect(getMindmapShortcutAction({ key: " " })).toEqual({ type: "toggle-fold" });
    expect(getMindmapShortcutAction({ key: "Delete" })).toEqual({ type: "delete" });
  });

  it("only Ctrl/Cmd+Enter focuses the body, avoiding a conflict with Shift+Enter adding a sibling", () => {
    expect(isFocusBodyShortcut({ key: "Enter", ctrlKey: true })).toBe(true);
    expect(isFocusBodyShortcut({ key: "Enter", metaKey: true })).toBe(true);
    expect(isFocusBodyShortcut({ key: "Enter", ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isFocusBodyShortcut({ key: "Enter" })).toBe(false);
  });

  it("Ctrl/Cmd+Space toggles the body pane in any mind map focus state", () => {
    expect(isToggleBodyShortcut({ key: " ", ctrlKey: true })).toBe(true);
    expect(isToggleBodyShortcut({ key: "", code: "Space", metaKey: true })).toBe(true);
    expect(isToggleBodyShortcut({ key: " ", shiftKey: true })).toBe(false);
  });

  it("the body source editor, inputs and editable content don't trigger mind map shortcuts", () => {
    expect(shouldIgnoreMindmapShortcutTarget({ isEditableElement: true })).toBe(true);
    expect(shouldIgnoreMindmapShortcutTarget({ isContentEditable: true })).toBe(true);
    expect(shouldIgnoreMindmapShortcutTarget({ insideSourceEditor: true })).toBe(true);
    expect(shouldIgnoreMindmapShortcutTarget({})).toBe(false);
  });

  it("buttons, links and clickable controls don't trigger mind map shortcuts", () => {
    expect(shouldIgnoreMindmapShortcutTarget({ isInteractiveElement: true })).toBe(true);
  });

  it("ordinary focusable mind map nodes still trigger mind map shortcuts", () => {
    expect(shouldIgnoreMindmapShortcutTarget({})).toBe(false);
  });

  it("any non-editing area in the view lets the document-level fallback shortcuts keep working", () => {
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: true,
        targetInsideModal: false,
        activeViewIsMindmap: true,
        activeElementIsPageRoot: false
      })
    ).toBe(true);
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: false,
        targetInsideModal: false,
        activeViewIsMindmap: true,
        activeElementIsPageRoot: true
      })
    ).toBe(true);
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: false,
        targetInsideModal: true,
        activeViewIsMindmap: true,
        activeElementIsPageRoot: true
      })
    ).toBe(false);
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: false,
        targetInsideModal: false,
        activeViewIsMindmap: false,
        activeElementIsPageRoot: true
      })
    ).toBe(false);
    expect(
      shouldHandleDocumentShortcutTarget({
        targetInsideView: true,
        targetInsideModal: false,
        activeViewIsMindmap: false,
        activeElementIsPageRoot: false
      })
    ).toBe(false);
  });
});

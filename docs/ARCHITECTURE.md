# Heading Mind Map Revamp Architecture Baseline

This document describes the stable structure of the codebase and its maintenance boundaries. It is for engineers who modify the plugin and focuses on: what the system is, how the core objects flow, how modules divide the work, and which rules must keep holding.

## What the system is

Heading Mind Map Revamp is an Obsidian plugin that treats the Markdown file as the only source of truth, edits the heading structure as a mind map, and shows and edits the current heading's body in a pane beside the map (on the right). Reading is rendered by Obsidian's `MarkdownRenderer`, editing is hosted by a real Obsidian Markdown editor, and the complete file is still held by that native editor.

The plugin keeps no separate business database. The Markdown text stores headings, bodies and file nodes; plugin data stores only mind map state, such as collapse state, file node expansion state, the list-item display switch and viewport position. The width of the note pane is part of each view's leaf state and is saved with the Obsidian workspace layout.

## Core objects

- `MindNode` is the in-memory node model of the mind map. It represents the document root node, ordinary heading nodes, file nodes and virtual list-item nodes.
- The document root node is derived from the current Markdown file. Its title is the file name and it is not serialized as a Markdown heading. All real Markdown headings are its children, so several H1 headings can exist as siblings.
- The Markdown file is the persistence source. It is parsed into a `MindNode` tree and serialized back to clean Markdown on save.
- A file node references another Markdown file. When it is expanded, the target file's outline is attached to the current mind map as a read-only preview.
- A virtual list-item node comes from a Markdown list item in a node's body. It is only for mind map display and is never written back to the Markdown heading structure.
- View state is stored with stable structure keys instead of runtime node ids, so collapse, expansion and selection can be restored after the file is re-parsed.

## Main flows

### Opening the mind map

`HeadingMindmapPlugin` registers the Obsidian view and commands. Command and ribbon tooltip text comes from `src/i18n.ts`, which is English only. When the user opens a mind map, the plugin decides the target file from the active mind map, the current Markdown file and the default path, then creates or reuses `hmr-view`.

### Loading and refreshing

Once the view receives a file path, the plugin reads the Markdown, parses it with the model layer into a `MindNode` tree rooted at the document root, and then applies the state saved in plugin data. When a normal Markdown file is modified externally, the plugin refreshes mind map views of the same file; if the modified file is the target of an expanded file node, the corresponding read-only outline is refreshed.

### Editing and saving

Heading structure operations are pure functions that modify the `MindNode` tree. The shortcut dispatch layer translates user actions into structure operations or view callbacks, and the view applies the results to the current selection, triggers saving and re-renders. Body text doesn't go through a plugin-built editor or save pipeline: `NativeMarkdownPane` coordinates reading and editing in the same note pane. `SectionPreviewView` renders the body fragment with the public `MarkdownRenderer.render`, and clicking the pencil or pressing `Ctrl+Enter` switches to the native `MarkdownView`. `section-projection` computes the current node's body range, and `section-projection-extension` uses CodeMirror's public extension points to hide content outside that range and lock it against editing. The native editor always holds the full text; after it writes to the file, the existing vault modify listener re-parses the mind map and the editing state is kept. When saving, the document root node itself is skipped and only real Markdown headings, the document root body, frontmatter and pre-heading text are serialized; virtual list items and expanded file outlines are never written back to the current Markdown file.

### Rendering

The mind map leaf shows a toolbar and a split area. The split area is a flex row containing the canvas, a draggable divider and the note pane (`src/split-divider-dom.ts`, `src/split-layout.ts`). The note pane width is stored as a ratio of the split area (clamped to 15%–85%) and exposed to CSS through the `--hmr-body-width` custom property, so it scales with the window. The ratio is part of the leaf state (`bodyWidthRatio`). On narrow screens the split stacks vertically and the divider is hidden.

Before layout, the canvas uses hidden measurement nodes that reuse the real theme, font, badge and wrapping CSS, reads the actual DOM size of each title and adds a safety margin. Tree layout then draws nodes and edges from the measured sizes, and long titles wrap fully. The toolbar provides zoom, fit-to-view and 100% reset entry points. The note pane hosts the embedded preview and the native Markdown editor; editing, extensions and image pasting are handled by Obsidian, and the visible range is projected by the registered CodeMirror extension, without copying or rewriting file content.

## Module boundaries

- `src/main.ts`: Obsidian plugin entry. Registers the view and commands, reads and writes files, reads and writes plugin data, resolves file node targets and refreshes across views.
- `src/i18n.ts`: English text for plugin commands and the ribbon tooltip.
- `src/mindmap-view.ts`: Obsidian `ItemView` coordination layer. Handles view state loading, the selected node, save scheduling, cross-module callbacks and the Obsidian lifecycle, without carrying canvas DOM, the body editor or shortcut operation details itself.
- `src/mindmap-view-store.ts`: runtime state container for the view. Holds the current file, root node, selected node, viewport, save queue, note pane width and the native body pane coordinator.
- `src/mindmap-view-loader.ts`: view loading and refresh controller. Applies leaf state, reloads from disk, refreshes expanded file outlines and restores view state.
- `src/mindmap-view-renderer.ts`: view rendering coordinator. Assembles the toolbar, canvas, divider and note pane, reads and restores the viewport, updates the selection state and positions the native body pane.
- `src/split-layout.ts`: pure helpers for the note pane width ratio (defaults, clamping, pointer-to-ratio conversion).
- `src/split-divider-dom.ts`: DOM for the draggable, keyboard-accessible divider and for applying the width ratio.
- `src/mindmap-view-actions.ts`: user action controller. Handles shortcut entry points, applying structure operation results, title editing, file node expansion, file selection and the list-item switch.
- `src/mindmap-view-persistence.ts`: save controller. Handles UI state saving, the Markdown write queue and tearing down the native body pane on close.
- `src/mindmap-toolbar-dom.ts`: toolbar DOM. Builds the title, path, zoom controls, list-item switch, add-file-node entry and shortcut reference entry.
- `src/mindmap-canvas-dom.ts`: canvas DOM. Handles canvas size, wheel zoom events, node and edge rendering, and forwarding node click / double-click / title input events.
- `src/viewport-dom.ts`: viewport and scroll DOM helpers. Handles scroll preservation, fit-to-view scaling, node-anchored zoom, scroll area size and centering offset for small maps.
- `src/mindmap-viewport-runtime.ts`: viewport runtime. Applies toolbar and wheel zoom actions to the measured canvas size and syncs the scroll area, centering offset and persisted state.
- `src/mindmap-node-measurer.ts`: node size measurement. Measures title width and height with the real DOM and current theme font, adds a safety margin and caches the results.
- `src/mindmap-node-display.ts`: node display metadata. Provides badge text per node type so measurement nodes match real nodes.
- `src/live-preview.ts`: CodeMirror extension that gives the embedded editor an Obsidian-like live preview (styles headings, emphasis, links, lists, quotes and code, and hides syntax marks away from the cursor).
- `src/embedded-editor-extensions.ts`: the CodeMirror extension set (Markdown language, live preview, history, keymap, theme) used by the embedded body editor.
- `src/canvas-pan.ts`: left-button drag-to-pan for the mind map canvas (ignored when a draggable node is pressed).
- `src/node-drag.ts`: pointer-based drag-and-drop of nodes (ghost, insertion line, edge auto-scroll); `src/drop-target.ts` is the pure logic that turns the pointer position into a before/after/child drop, including the gaps between nodes; the actual move is the pure `moveNodeTo` in `src/mindmap-operations.ts`.
- `src/native-editor-leaf.ts`: the default note editor. Opens (and reuses) a real Obsidian Markdown tab beside the mind map with the public `createLeafBySplit` / `openFile` APIs and projects the selected heading's section into it with `section-projection-extension`. The section is located by heading ordinal in the editor's current text, so unsaved edits don't misplace it. Reveal requests are coalesced (only the latest runs), and the note opens in live preview unless the vault's default editing mode is source mode.
- `src/mindmap-sync.ts`: when the file changes on disk and only text (not headings) changed, updates the existing node tree in place so the canvas isn't rebuilt (a rebuild while the user is clicking a node swallows the click).
- `src/settings-tab.ts`: settings tab with the Note editor choice (Obsidian editor or built-in pane).
- `src/native-markdown-pane.ts`: chooses between the Obsidian editor tab (`native-editor-leaf.ts`) and the built-in pane, which switches between the partial reading preview and an embedded CodeMirror editor.
- `src/section-preview-view.ts`: partial reading view. Renders the current body fragment with the public `MarkdownRenderer.render` and offers the entry to editing.
- `src/section-projection.ts`: computes, from a node's heading line, the character range of the visible body in the original Markdown. It ends at any next heading and handles frontmatter, code fences and Windows line endings.
- `src/section-projection-extension.ts`: registered with the native CodeMirror editor. Maintains the partial projection, hides content outside the range, prevents edits across the range and handles select-all for the current body.
- `src/native-markdown-location.ts`: determines the file and heading line the native editor should open for a mind map node.
- `src/mindmap-shortcut-dispatch.ts`: shortcut action dispatch. Translates shortcut actions into node operations, selection moves or view callbacks.
- `src/file-outline-runtime.ts`: file node outline runtime. Finds expanded file nodes, refreshes target file outlines, expands file nodes and returns the status.
- `src/mindmap-model.ts`: Markdown ↔ `MindNode` conversion. Parses headings, frontmatter, body collapse markers, file node titles and virtual list items.
- `src/mindmap-operations.ts`: mind map structure editing rules. Adding, deleting, reordering, promoting, collapsing and read-only restrictions.
- `src/mindmap-view-state.ts`: view state persistence rules. Structure keys and normalization of collapse, file expansion and viewport state.
- `src/tree-layout.ts`: pure layout calculation. Takes a node tree and outputs node positions, edges and canvas size.
- `src/keyboard-shortcuts.ts`, `src/mindmap-navigation.ts`, `src/node-selection.ts`: keyboard actions, node navigation and selection policy.
- `src/plugin-data.ts`: fault-tolerant normalization of persisted plugin data.
- `src/markdown-file-picker-modal.ts`: the Obsidian Modal used when adding a Markdown file node.
- `src/mindmap-shortcut-help.ts`, `src/mindmap-shortcut-help-modal.ts`: shortcut reference data and its modal rendering.
- `styles.css`: mind map and toolbar styles; it doesn't take over Obsidian's body editing or reading areas.

## Dependency direction

The plugin entry and view coordination layer may depend on the Obsidian API, DOM adapter modules and pure logic modules. The body pane calls only public `WorkspaceLeaf`, `MarkdownView`, `MarkdownRenderer`, `Editor` and `registerEditorExtension` APIs and never moves or embeds Obsidian's internal DOM. The model, operations, layout, state, navigation, selection, file outline runtime and policy modules should stay pure TypeScript logic with no direct dependency on the Obsidian runtime.

## Invariants that must hold

- The Markdown file is the only content source; plugin data must not store a copy of the heading tree or body text.
- Heading levels determine the real mind map levels, with at most six heading levels.
- The document root node doesn't correspond to a Markdown heading and must not be serialized as an H1; an H1 is an ordinary level-1 heading node under the document root and can have sibling H1s.
- An outline expanded from a file node is a read-only preview and can't rewrite the target file through the current mind map.
- An outline expanded from a file node contains only the target file's real heading nodes, not its document root node.
- Virtual list-item nodes come only from the body display switch and must not take part in saving the real structure, reordering, or persisted selection state.
- Saving the current mind map must not serialize an expanded file outline or virtual list items into the current Markdown.
- Several mind map views of the same file may have different leaf state; file-level plugin state stores only shareable collapse, expansion and default viewport information.
- The normal Markdown view and the mind map view stay consistent through the same Markdown file.
- The native editor in the note pane must hold the complete Markdown; the partial body may only be projected by hiding out-of-range content, never written to a separate file or used to overwrite the original through `setViewData`.
- When a user edits the partial body, they must not cross the body boundary to delete or modify adjacent headings.
- Candidates for adding a file node should support searching by path; the reading/source mode of the native body editor doesn't change the Markdown data model.
- The note pane width ratio is always clamped to its allowed range, so neither pane can be dragged out of view.

## Current boundaries

The current MVP doesn't include node style customization, image export, focus mode or full undo/redo integration. When adding these later, extend the pure logic modules and tests first and then attach the view layer as an adapter.

## Documentation organization boundary

The project is currently small, so module boundaries and the source mapping are kept in this one document. If separate feature areas, complex release decisions or cross-module constraints are added later, split out module documents, a separate source mapping and architecture decision records.

## Source mapping

| Architecture conclusion | Source | Status |
| --- | --- | --- |
| Markdown is the only content source; editing the mind map is equivalent to editing Markdown | `docs/PRD.md` sections 2, 3, 8; `src/mindmap-model.ts` | Confirmed |
| The document root node isn't written back as a Markdown heading; H1 is a real heading node that can have siblings | `docs/PRD.md` sections 3, 6, 10; `src/mindmap-model.ts`; `tests/mindmap-operations.test.ts` | Confirmed |
| The plugin entry registers views and commands and handles file reading/writing and refreshing | `src/main.ts` | Confirmed |
| The view layer is a thin coordinator; runtime state, loading, rendering, actions, saving, DOM, the native body pane, shortcut dispatch and file outline refresh live in separate modules | `src/mindmap-view.ts`; `src/mindmap-view-store.ts`; `src/mindmap-view-loader.ts`; `src/mindmap-view-renderer.ts`; `src/mindmap-view-actions.ts`; `src/mindmap-view-persistence.ts`; `src/mindmap-canvas-dom.ts`; `src/native-markdown-pane.ts`; `src/mindmap-shortcut-dispatch.ts`; `src/file-outline-runtime.ts`; `tests/view-source-contract.test.ts` | Confirmed |
| The mind map and note pane are laid out side by side with a clamped, resizable divider | `docs/PRD.md` section 4; `src/split-layout.ts`; `src/split-divider-dom.ts`; `styles.css`; `tests/split-layout.test.ts`; `tests/styles-contract.test.ts` | Confirmed |
| The model layer handles Markdown parsing, serialization, file nodes and virtual list items | `src/mindmap-model.ts`; `tests/outline-to-mindmap.test.ts` | Confirmed |
| Structure editing rules live in a pure function module | `src/mindmap-operations.ts`; `tests/mindmap-operations.test.ts` | Confirmed |
| View state uses structure keys instead of runtime node ids and stores mind map collapse, file expansion and viewport state | `src/mindmap-view-state.ts`; `tests/mindmap-view-state.test.ts` | Confirmed |
| The toolbar hosts the zoom and fit-to-view entries; the viewport helpers handle zoom and centering for whole-map viewing on mobile | `src/mindmap-toolbar-dom.ts`; `src/viewport-dom.ts`; `tests/viewport-dom.test.ts`; `tests/styles-contract.test.ts` | Confirmed |
| An outline expanded from a file node is a read-only preview | `docs/PRD.md` sections 2, 6, 10; `src/mindmap-operations.ts` | Confirmed |
| The model, operations, layout, state, file outline runtime and shortcut dispatch modules should have no Obsidian runtime dependency | Current test structure and module dependency direction; `tests/file-outline-runtime.test.ts`; `tests/mindmap-shortcut-dispatch.test.ts` | Confirmed |

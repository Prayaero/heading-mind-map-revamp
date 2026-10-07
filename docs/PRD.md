# Obsidian Mind Map Plugin PRD (MVP)

## 1. Product positioning

Let an Obsidian Markdown note be opened as an "editable mind map".

The mind map is a view of the note's heading structure. The user views and edits the heading hierarchy in the mind map on the left. On the right, the current heading's body is shown with Obsidian's Markdown renderer when reading and switches to a native Markdown editor when editing. The complete note stays in a single native editor state, and selecting a node updates the body projection. Heading, body and structure changes are all saved to the original Markdown file.

## 2. Core principles

- The Markdown file is the only source of truth.
- Heading levels determine mind map levels.
- The mind map has one document root node; heading nodes come from real Markdown headings. The document root itself is not written back as a Markdown heading.
- A node has a title and a body, but mind map nodes only show the heading structure.
- The body is shown and edited in the pane beside the mind map: reading uses the public `MarkdownRenderer` to render the current node's body, and editing uses a native Markdown editor. The plugin does not parse or generate Markdown HTML itself, and the complete file stays in the native editor state.
- Editing the mind map is equivalent to editing the Markdown note.
- A cross-file Markdown node can expand the target file's outline inside the current mind map.
- An expanded cross-file outline is a read-only preview.

## 3. Content rules

- The file name is the document root node title.
- `# Heading 1` is a level-1 heading node under the document root; several sibling H1 headings may exist.
- If a note has no level-1 heading, `# File name` is not synthesized; existing headings keep their original Markdown levels.
- A node's title comes from the Markdown heading text.
- A node's body is the Markdown content below that heading and before the next heading.
- Content under a sub-heading belongs to the child node.
- A file node's title shows the target Markdown file name.
- Double-clicking a file node generates a read-only sub-mind-map from the target Markdown file's heading hierarchy.
- When a file node is expanded, the target file's document root node is not shown, to avoid duplicating the file-name node already in the current mind map.
- Markdown list items in the body can optionally be shown as read-only virtual child nodes.
- YAML frontmatter stays at the top of the file and is not merged into any node body.
- Ordinary text before the first heading is shown and edited as the document root body, and is still written before the first heading when saved.
- Mind map state is stored in plugin data, not in the Markdown body.

## 4. Layout

The note can be shown in one of two ways, chosen in the plugin settings (Note editor). By default ("Obsidian editor") the selected heading's section opens in a normal Obsidian Markdown tab beside the mind map: the tab holds the whole file but everything outside the selected heading and its text is hidden and can't be edited, so the full native editor (live preview, plugins, embeds) can be used. Collapsing the note pane (`Ctrl+Space`) closes that tab and expanding it opens it again. The rest of this section describes the "Built-in pane" alternative, an editor embedded in the mind map view.

- The page uses a left/right split layout.
- The left side is the mind map area, which shows only the heading tree and node type markers.
- A draggable divider sits between the two panes. Dragging it resizes the mind map and the note pane, so the note pane can take as much room as the user wants. Double-clicking the divider resets the default width; with the divider focused, the Left/Right arrow keys resize it from the keyboard. The width is clamped so neither pane can disappear and is remembered per view.
- Mind map nodes adjust their width and height to the real layout of the current theme and font, keeping a safety margin; digits use tabular figures, and long titles wrap fully and stably instead of being truncated with an ellipsis.
- Mind map nodes stay pure heading structure; actions are provided by the keyboard and view-level commands.
- The right side is the note pane. When reading it shows only the current node's body. Clicking the pencil button or pressing `Ctrl+Enter` switches to the native editing state; the complete file is still maintained by that editor, and image pasting, plugin extensions and saving follow Obsidian's own behavior.
- The note pane can be collapsed into a narrow strip and restored (`Ctrl+Space` or the restore button on the strip).
- On narrow screens (760px and below) the panes stack vertically and the divider is hidden.
- The mind map toolbar provides touch buttons to zoom in, zoom out, fit the whole map to the current canvas, and reset to 100% zoom.
- After a mind map node is selected, the note pane updates to the corresponding body. Clicking the pencil button or pressing `Ctrl+Enter` enters the native editing state with the cursor at the start of the body. Expanded cross-file outline nodes open their target file.

## 5. Viewing

- Mind map nodes show the heading structure.
- Double-clicking an ordinary node collapses or expands its subtree.
- Double-clicking a file node expands or collapses the target Markdown file's outline.
- A view-level switch shows or hides body list items as read-only virtual nodes.
- The mind map lays itself out automatically.
- Basic panning, wheel zoom and toolbar zoom are supported; on mobile one tap fits the whole map to reduce repeated horizontal/vertical scrolling.
- Subtree collapse state, file expansion state, mind map viewport state and pane width are remembered by the plugin.
- The current viewport stays stable when selecting, double-clicking or editing nodes.

## 6. Editing

- Edit a node title inline in the mind map node.
- Edit a node body directly in the native Obsidian Markdown editor in the note pane.
- Add a child node.
- Add a sibling node.
- An H1 can get a sibling H1; only the document root node can't have siblings.
- Delete a node and its subtree.
- Reorder sibling nodes up and down.
- Drag a heading node (with its subtree) onto another node to move it: dropping in the empty space between two nodes (or just above the first / below the last node of a column) inserts it at that spot, shown by an insertion line; dropping on the upper or lower half of a node places it before or after that node (so reordering works on tiny, zoomed-out nodes too), and dropping on the right half of a node's middle band makes it that node's last child. Heading levels are adjusted to the new position. The document root, read-only nodes and moves that would exceed six levels or put a node inside its own subtree can't be dragged or dropped, and the drop target shows that.
- Promote a node.
- Pick a Markdown file from the current vault and add it as a file node.
- Adding a Markdown file node uses a searchable list picker with fuzzy search by file path.
- Operation results are written back to the Markdown file immediately.
- Headings support at most six levels; operations that would exceed six levels show a message and stop.
- The document root node's title comes from the current file name and can't be edited, deleted, reordered or promoted as an ordinary Markdown heading.
- Expanded cross-file outline nodes are read-only; structure, title and body editing operations show a message and stop.

## 7. Keyboard interaction

- `↑ / ↓`: move to the previous / next sibling node.
- `←`: move to the parent node.
- `→`: move to the first child node.
- `Enter`: edit the title inline.
- `Ctrl + Enter`: focus the native Obsidian Markdown editor in the note pane.
- `Ctrl + Space`: collapse or expand the note pane.
- `Tab`: add a child node.
- `Shift + Enter`: add a sibling node.
- `Shift + Tab`: promote the node.
- `Alt + ↑ / Alt + ↓`: reorder siblings.
- `Space`: collapse / expand the current node's subtree.
- `Delete`: delete the node.

The mind map toolbar has a keyboard-shortcuts button that shows the operations above.

## 8. Consistency requirements

- The mind map view and the normal Markdown view always show the same content.
- After a change in the normal view, the mind map view refreshes automatically.
- After a change in the mind map view, the normal view shows clean Markdown.
- The same note can be open in a mind map view and a source view at the same time.
- Several mind map views of the same file keep their own selection, scroll and zoom state.
- The plugin stores subtree collapse, file expansion, mind map viewport and pane width state.

## 9. MVP boundaries

- Editing list items as real heading nodes is left for a later version; this version only supports optional read-only display.
- Custom node colors, icons and shapes are left for a later version.
- Free node placement is left for a later version.
- Image export is left for a later version.
- Focus mode is left for a later version.
- Full undo/redo integration is left for a later version.

## 10. Acceptance criteria

- An ordinary Markdown note can be opened as a mind map.
- Heading levels match the mind map structure.
- Several H1 headings are shown and edited as sibling level-1 headings under the document root.
- The mind map on the left shows only the heading tree, and nodes stay pure heading structure.
- In reading mode the note pane on the right shows only the selected node's Markdown body, generated by Obsidian's Markdown renderer; in native editing mode, edits can't delete adjacent headings or go beyond the current body range.
- After pasting an image in the body source editor, Markdown contains an Obsidian image embed link and the attachment file is saved to the vault's attachment location.
- The divider between the mind map and the note pane can be dragged to resize both panes, the width is clamped to a sensible range, and it is restored after closing and reopening the view.
- The note pane can be collapsed into a side strip and restored.
- Body list items can optionally be shown as virtual mind map child nodes, and turning this off doesn't affect the Markdown content or real heading state.
- A title can be edited inline in a mind map node, and editing stays in the current mind map context.
- Double-clicking an ordinary node collapses or expands its subtree.
- Double-clicking a file node expands or collapses the target Markdown file's outline.
- An expanded file node doesn't additionally show the target file's document root node.
- When adding a file node, the target Markdown file can be found by path in the searchable list.
- Clicking the toolbar shortcuts button opens the shortcut reference.
- Expanded cross-file outline nodes are read-only, and editing operations give a clear message.
- The toolbar zoom buttons can zoom in, zoom out, reset zoom, and fit the current mind map into the visible canvas.
- All keyboard operations work as defined.
- After editing in the mind map and switching back to the normal view, the Markdown content is correct and clean.
- Adding a child under a level-6 node shows a clear message.
- After closing and reopening, subtree collapse state, file expansion state, viewport state and pane width are preserved.
- Double-clicking or operating on nodes doesn't flicker the UI, and the scroll position stays stable.

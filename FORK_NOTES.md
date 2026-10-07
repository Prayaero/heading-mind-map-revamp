# What changed from the original

Heading Mind Map Revamp is based on [Heading Mindmap](https://github.com/JhihJian/obsidian-heading-mindmap) v0.1.1 (commit `282394622251cfb980da0979480aec54775558b8`, MIT).

- English only: all Chinese text (interface, tests, docs, comments) was translated and the Chinese locale was removed.
- New identity: plugin id `heading-mind-map-revamp`, view type `heading-mind-map-revamp-view`, CSS classes prefixed `hmr-`, so it can be installed next to the original.
- Left/right layout with a draggable divider (built-in pane), later complemented by the Obsidian editor tab.
- Note editor setting (default: a real Obsidian tab beside the mind map showing only the selected section; the earlier built-in pane is still available). A "Show diagnostic messages" switch helps with troubleshooting.
- Live-preview styling in the built-in editor, and the selected heading shown above its body.
- Drag the canvas to pan; drag nodes to reorder or re-parent them (gap-aware drop with an insertion line, generous drop zones for small nodes).
- Restyled mind map: color-coded branches, gradient root node, depth shading, dotted canvas, hover and selection glow.
- Fixes: the pencil button after cancelling an edit, text edits no longer rebuild the canvas, the Obsidian editor tab keeps heading styling and recovers if it stops responding.
- Removed the original author's personal install script and old marketing screenshots.

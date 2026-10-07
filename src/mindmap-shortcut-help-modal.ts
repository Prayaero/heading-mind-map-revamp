import { Modal, type App } from "obsidian";
import { MINDMAP_SHORTCUT_HELP } from "./mindmap-shortcut-help";

export class MindmapShortcutHelpModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Keyboard shortcuts");
    this.contentEl.empty();

    const table = this.contentEl.createEl("table", { cls: "hmr-shortcut-table" });
    const header = table.createEl("thead").createEl("tr");
    header.createEl("th", { text: "Shortcut" });
    header.createEl("th", { text: "Action" });

    const body = table.createEl("tbody");
    for (const item of MINDMAP_SHORTCUT_HELP) {
      const row = body.createEl("tr");
      row.createEl("td").createEl("kbd", { text: item.keys });
      row.createEl("td", { text: item.action });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

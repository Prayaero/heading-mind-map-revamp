import { PluginSettingTab, Setting, type App } from "obsidian";
import { normalizeNoteEditorMode } from "./plugin-data";
import type HeadingMindmapPlugin from "./main";

export class HeadingMindmapSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: HeadingMindmapPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Note editor")
      .setDesc(
        "Where the selected heading's text is shown and edited. 'Obsidian editor' opens the note in a normal Obsidian " +
          "tab beside the mind map, showing only the selected section. 'Built-in pane' keeps a simpler editor inside the mind map."
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("obsidian", "Obsidian editor (separate tab)")
          .addOption("built-in", "Built-in pane (inside the mind map)")
          .setValue(this.plugin.getNoteEditorMode())
          .onChange(async (value) => {
            await this.plugin.setNoteEditorMode(normalizeNoteEditorMode(value));
          })
      );

    new Setting(containerEl)
      .setName("Show diagnostic messages")
      .setDesc("Shows small on-screen messages each time the Obsidian editor tab changes section. Turn this on only when troubleshooting.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.getDebugNotices()).onChange(async (value) => {
          await this.plugin.setDebugNotices(value);
        })
      );
  }
}

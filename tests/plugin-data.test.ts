import { describe, expect, it } from "vitest";
import { normalizePluginData } from "../src/plugin-data";

describe("plugin data", () => {
  it("normalizes empty data to the default plugin state", () => {
    expect(normalizePluginData(null)).toEqual({
      files: {},
      expandListItems: false,
      noteEditor: "obsidian",
      debugNotices: false
    });
  });

  it("keeps valid file state and filters out invalid persisted keys", () => {
    const data = normalizePluginData({
      expandListItems: true,
      files: {
        "notes/map.md": {
          collapsedNodeKeys: ["root[0]", 1, null],
          expandedFileNodeKeys: ["root[0]/file[0]", false],
          viewport: { scale: 3, scrollLeft: -4, scrollTop: 24 },
          bodyPane: { heightRatio: 0.9, minimized: true }
        },
        "": {
          collapsedNodeKeys: ["ignored"]
        },
        "notes/broken.md": null
      }
    });

    expect(data).toEqual({
      expandListItems: true,
      noteEditor: "obsidian",
      debugNotices: false,
      files: {
        "notes/map.md": {
          collapsedNodeKeys: ["root[0]"],
          expandedFileNodeKeys: ["root[0]/file[0]"],
          viewport: { scale: 2, scrollLeft: 0, scrollTop: 24 }
        }
      }
    });
  });

  it("keeps a valid note editor choice and ignores unknown values", () => {
    expect(normalizePluginData({ files: {}, noteEditor: "built-in" }).noteEditor).toBe("built-in");
    expect(normalizePluginData({ files: {}, noteEditor: "nonsense" }).noteEditor).toBe("obsidian");
    expect(normalizePluginData({ noteEditor: "built-in" }).noteEditor).toBe("built-in");
  });
});

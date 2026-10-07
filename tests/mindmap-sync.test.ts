import { describe, expect, it } from "vitest";
import { parseMindmapMarkdown } from "../src/mindmap-model";
import { hasSameStructure, syncMindmapContent } from "../src/mindmap-sync";

const original = "# Product\n\nIntro\n\n## Goal\n\nGoal body\n\n## Risk\n\nRisk body\n";

describe("mindmap sync", () => {
  it("updates body text and line numbers in place when only text changed", () => {
    const current = parseMindmapMarkdown("map.md", original);
    const goalBefore = current.children[0].children[0];
    const idBefore = goalBefore.id;
    const edited = parseMindmapMarkdown("map.md", original.replace("Goal body", "Goal body\n\nMore lines\nstill more"));

    expect(syncMindmapContent(current, edited)).toBe(true);

    const goal = current.children[0].children[0];
    expect(goal).toBe(goalBefore);
    expect(goal.id).toBe(idBefore);
    expect(goal.body).toBe("Goal body\n\nMore lines\nstill more");
    expect(current.children[0].children[1].sourceLine).toBe(edited.children[0].children[1].sourceLine);
  });

  it("keeps UI-only state such as collapsed subtrees", () => {
    const current = parseMindmapMarkdown("map.md", original);
    current.children[0].childrenCollapsed = true;
    syncMindmapContent(current, parseMindmapMarkdown("map.md", original.replace("Intro", "Changed intro")));

    expect(current.children[0].childrenCollapsed).toBe(true);
    expect(current.children[0].body).toBe("Changed intro");
  });

  it("refuses to sync when headings were renamed, added, removed or re-levelled", () => {
    const current = parseMindmapMarkdown("map.md", original);
    const variants = [
      original.replace("## Goal", "## Aim"),
      `${original}\n## Extra\n`,
      original.replace("\n## Risk\n\nRisk body\n", ""),
      original.replace("## Risk", "### Risk")
    ];
    for (const markdown of variants) {
      const fresh = parseMindmapMarkdown("map.md", markdown);
      expect(hasSameStructure(current, fresh)).toBe(false);
      expect(syncMindmapContent(current, fresh)).toBe(false);
    }
    expect(current.children[0].children[0].title).toBe("Goal");
  });
});

import { describe, expect, it } from "vitest";
import { getHeadingMindmapStrings } from "../src/i18n";

describe("heading mindmap strings", () => {
  it("provides English command and ribbon labels", () => {
    const strings = getHeadingMindmapStrings();

    expect(strings.commands.open).toBe("Open mind map");
    expect(strings.commands.toggleListItemExpansion).toBe("Toggle body list items in mind map");
    expect(strings.ribbon.open).toBe("Open mind map");
  });
});

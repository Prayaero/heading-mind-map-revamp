import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Manifest = {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
  authorUrl: string;
  isDesktopOnly: boolean;
};

const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as Manifest;
const versions = JSON.parse(readFileSync("versions.json", "utf8")) as Record<string, string>;

describe("community release contract", () => {
  it("manifest has the basic fields required by the Obsidian community plugin directory", () => {
    expect(manifest).toMatchObject({
      id: "heading-mind-map-revamp",
      name: "Heading Mind Map Revamp",
      author: "Aero",
      authorUrl: "https://github.com/prayaero",
      isDesktopOnly: false
    });
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.minAppVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.id).not.toContain("obsidian");
    expect(manifest.name).not.toMatch(/obsidian/i);
    expect(manifest.description).not.toMatch(/obsidian/i);
    expect(manifest.description.length).toBeLessThanOrEqual(250);
    expect(manifest.description).toMatch(/\.$/);
  });

  it("versions.json maps the current version to the minimum Obsidian version", () => {
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
  });

  it("repository contains the root files required for official directory submission", () => {
    expect(existsSync("README.md")).toBe(true);
    expect(existsSync("LICENSE")).toBe(true);
    expect(existsSync("manifest.json")).toBe(true);
  });

  it("command IDs do not repeat the plugin ID", () => {
    const source = readFileSync("src/main.ts", "utf8");

    expect(source).toContain('id: "open"');
    expect(source).not.toContain('id: "open-heading-mind-map-revamp"');
  });

  it("GitHub Release workflow builds and uploads the Obsidian install assets", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");

    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("main.js manifest.json styles.css");
  });
});

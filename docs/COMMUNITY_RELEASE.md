# Publishing and the community plugin list

## What is already prepared

- `manifest.json`: unique id `heading-mind-map-revamp`, name `Heading Mind Map Revamp`, author `Aero`, a short description without the word "Obsidian".
- `versions.json`: maps each plugin version to the minimum Obsidian version it needs.
- `LICENSE` (MIT, with the original author's notice kept) and a user-facing `README.md`.
- `.github/workflows/release.yml`: builds the plugin and publishes a GitHub release containing `main.js`, `manifest.json` and `styles.css`.
- Command ids do not repeat the plugin id (Obsidian shows `heading-mind-map-revamp:open`).

## Publishing a release

1. Make sure `version` in `manifest.json` is the version you want (format `x.y.z`, no `v`) and that `versions.json` has a matching line.
2. On GitHub open **Actions → Release plugin → Run workflow**. It runs the tests, builds the plugin and creates a release named after the version, with the three files attached.
   (Pushing a tag that equals the version does the same.)
3. Check the **Releases** page: the release must list `main.js`, `manifest.json` and `styles.css`.

For the next version, change `version` in `manifest.json` and `package.json`, add a line to `versions.json`, and run the workflow again. Never reuse a version number.

## Sharing before it is in the community list

Anyone can install the plugin right away with the **BRAT** plugin (Add beta plugin → paste the repository address), or by downloading the three release files into `.obsidian/plugins/heading-mind-map-revamp/`.

## Getting it into the community plugin list

1. The repository must be public and contain `manifest.json`, `README.md` and `LICENSE` at its root, and a published release for the version in `manifest.json`.
2. Fork [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases).
3. In your fork edit `community-plugins.json` and add this entry at the end of the list (keep the comma rules of JSON):

   ```json
   {
     "id": "heading-mind-map-revamp",
     "name": "Heading Mind Map Revamp",
     "author": "Aero",
     "description": "Turn a note's headings into a colorful, draggable mind map and edit each section in the editor beside it.",
     "repo": "prayaero/heading-mind-map-revamp"
   }
   ```

   (`repo` is `<your GitHub user>/<repository name>`.)
4. Open a pull request to `obsidianmd/obsidian-releases` and tick the checklist in its template. A bot checks the entry, then the Obsidian team reviews the plugin; fix anything they ask for and the plugin appears in the list once approved. Review can take weeks.

## Checks before submitting

- The release tag equals `version` in `manifest.json`.
- The release has `main.js`, `manifest.json` and `styles.css` attached.
- The plugin name and description do not contain "Obsidian"; the id does not contain "obsidian".
- If `minAppVersion` is raised later, update `versions.json` too.

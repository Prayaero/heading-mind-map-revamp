import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { execFileSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";

const port = Number(process.env.OBSIDIAN_E2E_PORT ?? 9240);
const root = join(tmpdir(), `obsidian-mindmap-e2e-${port}`);
const vault = join(root, "vault");
const userData = join(root, "user-data");
const obsidianExe = process.env.OBSIDIAN_EXE ?? "C:\\Program Files\\Obsidian\\Obsidian.exe";
const pluginDir = join(vault, ".obsidian", "plugins", "heading-mind-map-revamp");

function ps(script) {
  return execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" });
}

function stopTempObsidian() {
  const escaped = userData.replaceAll("'", "''");
  ps(`Get-CimInstance Win32_Process -Filter "name = 'Obsidian.exe'" |
    Where-Object { $_.CommandLine -like "*${escaped}*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`);
}

function setupVault() {
  stopTempObsidian();
  rmSync(root, { recursive: true, force: true });
  mkdirSync(pluginDir, { recursive: true });
  mkdirSync(userData, { recursive: true });
  for (const file of ["main.js", "manifest.json", "styles.css"]) copyFileSync(file, join(pluginDir, file));
  writeFileSync(join(vault, ".obsidian", "app.json"), "{}", "utf8");
  writeFileSync(join(vault, ".obsidian", "appearance.json"), "{}", "utf8");
  writeFileSync(join(vault, ".obsidian", "community-plugins.json"), '["heading-mind-map-revamp"]', "utf8");
  writeFileSync(join(userData, "obsidian.json"), JSON.stringify({ vaults: { e2e: { path: vault, ts: Date.now(), open: true } } }), "utf8");
  writeFileSync(join(vault, "product.md"), "# Product\n\nOverview\n\n## Goal\n\nGoal body\n\n### Measure\n\nMetric body\n\n## Empty alpha\n\n## Empty beta\n\n## Risk\n\nRisk body\n", "utf8");
}

function assert(condition, message, details) {
  if (!condition) throw new Error(`${message}\n${JSON.stringify(details, null, 2)}`);
}

async function cdp(method, params = {}, timeoutMs = 5000) {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("No Obsidian page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  return await new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      ws.close();
      resolve(value);
    };
    ws.addEventListener("open", () => ws.send(JSON.stringify({ id: 1, method, params })));
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id === 1) finish(message);
    });
    ws.addEventListener("error", (event) => finish({ error: String(event.message || event.type) }));
    setTimeout(() => finish({ timeout: true }), timeoutMs);
  });
}

async function evaluate(expression, timeoutMs = 5000) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (result.timeout || result.error || result.error?.message || result.result?.exceptionDetails) {
    throw new Error(JSON.stringify(result, null, 2));
  }
  return result.result.result.value;
}

async function waitForReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if (await evaluate("Boolean(window.app && app.workspace && app.vault)", 2000)) return;
    } catch {
      // Obsidian has not exposed its page yet.
    }
    await sleep(500);
  }
  throw new Error("Obsidian did not become ready");
}

async function main() {
  setupVault();
  const child = spawn(obsidianExe, [`--remote-debugging-port=${port}`, `--user-data-dir=${userData}`, vault], {
    detached: false,
    stdio: "ignore"
  });

  try {
    await waitForReady();
    const report = await evaluate(`
      (async () => {
        await app.plugins.setEnable(true);
        await app.plugins.loadManifests();
        await app.plugins.enablePluginAndSave('heading-mind-map-revamp');
        for (let attempt = 0; attempt < 20 && !app.commands.commands['heading-mind-map-revamp:open']; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        const product = app.vault.getAbstractFileByPath('product.md');
        const sourceLeaf = app.workspace.getLeaf(false);
        await sourceLeaf.openFile(product);
        await app.commands.executeCommandById('heading-mind-map-revamp:open');
        await new Promise((resolve) => setTimeout(resolve, 1400));

        const mindmapLeaf = app.workspace.getLeavesOfType('heading-mind-map-revamp-view')[0];
        const root = mindmapLeaf?.view?.containerEl?.querySelector('.hmr-view');
        const findLabel = (label) => Array.from(root?.querySelectorAll('.hmr-node') || []).find((node) =>
          ((node.querySelector('.hmr-node-badge')?.textContent || '') + ':' +
            (node.querySelector('.hmr-node-title')?.textContent ||
              node.querySelector('.hmr-node-title-input')?.value || '')) === label
        );
        const goal = findLabel('H2:Goal');
        goal?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 500));

        const previewLeaves = app.workspace.getLeavesOfType('hmr-section-preview');
        const previewText = root?.querySelector('.hmr-body-content')?.textContent ?? '';
        const bodyTitle = root?.querySelector('.hmr-body-title')?.textContent ?? '';
        const canvas = root?.querySelector('.hmr-canvas');
        canvas?.focus({ preventScroll: true });
        canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        let newestLeaf;
        for (let attempt = 0; attempt < 20 && !newestLeaf; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          newestLeaf = findLabel('H3:New node');
        }
        const risk = findLabel('H2:Risk');
        risk?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 180));
        newestLeaf?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 300));
        const newestLeafSelected = newestLeaf?.classList.contains('is-selected') ?? false;
        const newestLeafTitle = root?.querySelector('.hmr-body-title')?.textContent ?? '';
        const newestLeafText = root?.querySelector('.hmr-body-content')?.textContent ?? '';
        const emptyAlpha = findLabel('H2:Empty alpha');
        emptyAlpha?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 500));
        const emptyAlphaTitle = root?.querySelector('.hmr-body-title')?.textContent ?? '';
        const emptyAlphaText = root?.querySelector('.hmr-body-content')?.textContent ?? '';
        const emptyBeta = findLabel('H2:Empty beta');
        emptyBeta?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 500));
        const emptyBetaTitle = root?.querySelector('.hmr-body-title')?.textContent ?? '';
        const emptyBetaText = root?.querySelector('.hmr-body-content')?.textContent ?? '';
        goal?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 300));
        canvas?.focus({ preventScroll: true });
        canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 120));
        const bodyCollapsed = root?.querySelector('.hmr-body.is-collapsed') !== null;
        const collapsedTitle = root?.querySelector('.hmr-body-collapsed-title')?.textContent ?? '';
        canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 120));
        const bodyExpanded = root?.querySelector('.hmr-body.is-collapsed') === null;
        canvas?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
        for (let attempt = 0; attempt < 20 && !root?.querySelector('.hmr-body-editor .cm-content')?.textContent; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        const markdownLeaves = app.workspace.getLeavesOfType('markdown');
        const editor = root?.querySelector('.hmr-body-editor');
        const editorText = editor?.querySelector('.cm-content')?.textContent ?? '';
        const editorMounted = editor?.querySelector('.cm-editor') !== null;
        const editorView = editor?.querySelector('.cm-editor')?.headingMindmapEditor;
        editorView?.dispatch({ changes: { from: editorView.state.doc.length, insert: ' Inline editor write' } });
        editor?.querySelector('.cm-content')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 900));
        const markdown = await app.vault.read(product);
        const editorStayedInPlace = app.workspace.getLeavesOfType('markdown').length === markdownLeaves.length &&
          root?.querySelector('.hmr-body-content')?.textContent?.includes('Inline editor write') &&
          root?.querySelector('.hmr-body-editor') === null;
        mindmapLeaf?.detach();
        await new Promise((resolve) => setTimeout(resolve, 300));

        return {
          labels: Array.from(root?.querySelectorAll('.hmr-node') || []).length,
          nodeButtons: root?.querySelectorAll('.hmr-node button').length ?? -1,
          previewLeavesBeforeEdit: previewLeaves.length,
          previewText,
          bodyTitle,
          newestLeafFound: Boolean(newestLeaf),
          newestLeafSelected,
          newestLeafTitle,
          newestLeafText,
          emptyAlphaTitle,
          emptyAlphaText,
          emptyBetaTitle,
          emptyBetaText,
          bodyCollapsed,
          collapsedTitle,
          bodyExpanded,
          editorText,
          editorMounted,
          savedInlineEdit: markdown.includes('Inline editor write'),
          editorStayedInPlace,
          markdownLeavesAfterClose: app.workspace.getLeavesOfType('markdown').length
        };
      })()
    `, 90000);

    assert(report.labels >= 5, "Mind map headings did not render", report);
    assert(report.nodeButtons === 0, "Mind map nodes must remain title-only", report);
    assert(report.previewLeavesBeforeEdit === 0, "Reading preview must not create a workspace tab", report);
    assert(report.previewText.includes("Goal body"), "Reading preview did not render the selected section body", report);
    assert(!report.previewText.includes("Overview") && !report.previewText.includes("Metric body") && !report.previewText.includes("Risk body"), "Reading preview exposed content outside the selected section", report);
    assert(report.bodyTitle === "Goal", "Reading preview did not show the selected node title", report);
    assert(report.newestLeafFound, "Newest leaf node was not rendered", report);
    assert(report.newestLeafSelected, "Clicking the newest leaf node did not update selection", report);
    assert(report.newestLeafTitle === "New node" && report.newestLeafText.includes("No body text"), "Newest leaf node did not update the body pane", report);
    assert(report.emptyAlphaTitle === "Empty alpha" && report.emptyBetaTitle === "Empty beta", "Switching empty nodes did not update the body context", report);
    assert(report.emptyAlphaText.includes("No body text") && report.emptyBetaText.includes("No body text"), "Empty nodes did not show an explicit empty state", report);
    assert(report.bodyCollapsed && report.bodyExpanded, "Ctrl+Space did not toggle the body pane", report);
    assert(report.collapsedTitle === "Goal", "Collapsed body pane did not retain the selected node title", report);
    assert(report.editorText.includes("Goal body"), "Scoped editor did not show the selected section body", report);
    assert(!report.editorText.includes("Overview") && !report.editorText.includes("Metric body") && !report.editorText.includes("Risk body"), "Scoped editor exposed content outside the selected section", report);
    assert(report.editorMounted, "Ctrl+Enter did not open the inline editor", report);
    assert(report.savedInlineEdit, "Ctrl+Enter did not save the inline editor changes", report);
    assert(report.editorStayedInPlace, "Saving the inline editor changed the workspace layout", report);
    assert(report.markdownLeavesAfterClose === 1, "Closing the mind map changed the source Markdown tab", report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    child.kill();
    stopTempObsidian();
  }
}

if (!existsSync("main.js")) throw new Error("main.js not found; run npm run build first");
main().catch((error) => {
  stopTempObsidian();
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

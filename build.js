/**
 * Build step for The Studio Contract.
 *
 * This site has no framework and no client-side data fetching for
 * Global Settings (logo + footer text) anymore — instead, this script
 * runs automatically during every Netlify deploy and writes the current
 * values from data/site-settings.json directly into each HTML page
 * before it's served.
 *
 * Why: fetching settings in the browser after the page loads caused a
 * brief "flash" of the old logo/footer before the real one appeared.
 * Baking the values in at build time means the correct content is in
 * the HTML from the very first byte — nothing to fetch, nothing to swap,
 * no flash.
 *
 * Nothing about this requires Keke to write or run any code by hand.
 * Netlify runs `node build.js` automatically on every push — including
 * pushes made by Decap CMS through Git Gateway when Keke edits Global
 * Settings from /admin and hits "Publish."
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SETTINGS_PATH = path.join(ROOT, "data", "site-settings.json");
const DEFAULT_LOGO_SRC = "assets/logo-nav.png";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const data = JSON.parse(raw);
    return {
      logo: typeof data.logo === "string" && data.logo.trim() ? data.logo.trim() : DEFAULT_LOGO_SRC,
      footerText: typeof data.footer_text === "string" && data.footer_text.trim() ? data.footer_text.trim() : null,
    };
  } catch (err) {
    console.warn("[build] Could not read data/site-settings.json, using defaults baked into HTML. Reason:", err.message);
    return { logo: DEFAULT_LOGO_SRC, footerText: null };
  }
}

function applySettingsToFile(filePath, settings) {
  let html = fs.readFileSync(filePath, "utf8");
  let changed = false;

  // Logo: every page's header always ships with the default logo src
  // baked in as a stable anchor point for this replacement.
  const logoPattern = new RegExp(
    `(class="brand"[^>]*>\\s*<img[^>]*src=")${DEFAULT_LOGO_SRC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(")`
  );
  if (settings.logo !== DEFAULT_LOGO_SRC && logoPattern.test(html)) {
    html = html.replace(logoPattern, `$1${settings.logo}$2`);
    changed = true;
  }

  // Footer text: replace the full contents of #footer-text, whatever
  // they currently are, with the escaped current setting.
  const footerPattern = /(<span id="footer-text">)[\s\S]*?(<\/span>)/;
  if (settings.footerText && footerPattern.test(html)) {
    html = html.replace(footerPattern, `$1${escapeHtml(settings.footerText)}$2`);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, html, "utf8");
  }
  return changed;
}

function main() {
  const settings = loadSettings();
  const htmlFiles = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".html")); // root-level pages only — admin/index.html is a different template and is left alone

  let updatedCount = 0;
  for (const file of htmlFiles) {
    const full = path.join(ROOT, file);
    if (applySettingsToFile(full, settings)) updatedCount++;
  }

  console.log(`[build] Global Settings applied. Logo: "${settings.logo}". Footer text updated: ${settings.footerText ? "yes" : "no (using page defaults)"}. Files changed: ${updatedCount}/${htmlFiles.length}.`);
}

main();

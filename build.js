/**
 * Build step for The Studio Contract.
 *
 * This site has no framework. Instead, this script runs automatically
 * during every Netlify deploy (see netlify.toml) and:
 *
 *   1. Bakes the Global Settings (logo + footer text) into every page
 *      before it's served. Doing this at build time — instead of
 *      fetching it in the browser after the page loads — means there's
 *      no "flash" of the old logo/footer before the real one appears.
 *
 *   2. Reads any Directory, Podcast, or Templates entries Decap CMS has
 *      written (as flat-frontmatter .md files) and turns them into the
 *      HTML cards on directory.html, podcast.html, and templates.html.
 *
 * Nothing here requires Keke to write or run code by hand. Netlify runs
 * `node build.js` automatically on every push — including pushes made
 * by Decap CMS through Git Gateway when Keke hits "Publish" in /admin.
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

/**
 * Minimal frontmatter parser for Decap CMS entries. Our collections
 * (directory, podcast, templates) only ever produce flat "key: value"
 * frontmatter — no nested objects or lists — so a small hand-rolled
 * parser avoids needing an npm dependency (and therefore an
 * `npm install` step) just for this.
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }
  return data;
}

function listEntries(folderName) {
  const dir = path.join(ROOT, folderName);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((entry) => Object.keys(entry).length > 0);
}

function injectBetweenMarkers(html, markerName, innerHtml) {
  const pattern = new RegExp(
    `(<!-- CMS:${markerName} -->)[\\s\\S]*?(<!-- /CMS:${markerName} -->)`
  );
  if (!pattern.test(html)) return { html, changed: false };
  return { html: html.replace(pattern, `$1\n${innerHtml}\n$2`), changed: true };
}

function applySettingsToFile(filePath, settings) {
  let html = fs.readFileSync(filePath, "utf8");
  let changed = false;

  const logoPattern = new RegExp(
    `(class="brand"[^>]*>\\s*<img[^>]*src=")${DEFAULT_LOGO_SRC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(")`
  );
  if (settings.logo !== DEFAULT_LOGO_SRC && logoPattern.test(html)) {
    html = html.replace(logoPattern, `$1${settings.logo}$2`);
    changed = true;
  }

  const footerPattern = /(<span id="footer-text">)[\s\S]*?(<\/span>)/;
  if (settings.footerText && footerPattern.test(html)) {
    html = html.replace(footerPattern, `$1${escapeHtml(settings.footerText)}$2`);
    changed = true;
  }

  if (changed) fs.writeFileSync(filePath, html, "utf8");
  return changed;
}

function directoryCardHtml(entry) {
  const name = escapeHtml(entry.name || "Untitled listing");
  const category = escapeHtml(entry.category || "");
  const location = escapeHtml(entry.location || "");
  const description = escapeHtml(entry.description || "");
  const photo = entry.photo
    ? `<div class="photo-wrap"><img src="${escapeHtml(entry.photo)}" alt="${name}" loading="lazy"></div>`
    : `<div class="photo-wrap"></div>`;
  const contacts = [];
  if (entry.phone) contacts.push(`<a href="tel:${escapeHtml(entry.phone).replace(/\s+/g, "")}">${escapeHtml(entry.phone)}</a>`);
  if (entry.email) contacts.push(`<a href="mailto:${escapeHtml(entry.email)}">${escapeHtml(entry.email)}</a>`);
  if (entry.website) contacts.push(`<a href="${escapeHtml(entry.website)}" target="_blank" rel="noopener">Website</a>`);
  const contactsHtml = contacts.length ? `<div class="directory-contact">${contacts.join("")}</div>` : "";
  return `<article class="directory-card" data-category="${category}">
      ${photo}
      <div class="directory-body">
        <h3>${name}</h3>
        <div class="directory-loc">${category}${location ? ` &middot; ${location}` : ""}</div>
        ${description ? `<p class="directory-desc">${description}</p>` : ""}
        ${contactsHtml}
      </div>
    </article>`;
}

function podcastCardHtml(entry) {
  const title = escapeHtml(entry.title || "Untitled episode");
  const description = escapeHtml(entry.description || "");
  const epNum = entry.episode_number ? `Episode ${escapeHtml(entry.episode_number)}` : "Episode";
  const cover = entry.cover
    ? `<div class="cover-wrap"><img src="${escapeHtml(entry.cover)}" alt="${title}" loading="lazy"></div>`
    : `<div class="cover-wrap"></div>`;
  const links = [];
  if (entry.spotify_url) links.push(`<a href="${escapeHtml(entry.spotify_url)}" target="_blank" rel="noopener">Spotify</a>`);
  if (entry.youtube_url) links.push(`<a href="${escapeHtml(entry.youtube_url)}" target="_blank" rel="noopener">YouTube</a>`);
  if (entry.apple_url) links.push(`<a href="${escapeHtml(entry.apple_url)}" target="_blank" rel="noopener">Apple Podcasts</a>`);
  const linksHtml = links.length ? `<div class="podcast-links">${links.join("")}</div>` : "";
  return `<article class="podcast-card">
      ${cover}
      <div class="podcast-body">
        <div class="podcast-eyebrow">${epNum}</div>
        <h3>${title}</h3>
        ${description ? `<p class="podcast-desc">${description}</p>` : ""}
        ${linksHtml}
      </div>
    </article>`;
}

function templateCardHtml(entry) {
  const title = escapeHtml(entry.title || "Untitled template");
  const description = escapeHtml(entry.description || "");
  const meta = entry.pages ? `${escapeHtml(entry.pages)} page${String(entry.pages) === "1" ? "" : "s"}` : "PDF";
  const downloadHtml = entry.file
    ? `<a href="${escapeHtml(entry.file)}" download>Download &rarr;</a>`
    : `<span style="color:var(--ink-faint);">File pending</span>`;
  return `<article class="work" data-type="template">
      <div class="work-top">
        <h3>${title}</h3>
        <span class="work-type">PDF</span>
      </div>
      ${description ? `<p>${description}</p>` : ""}
      <div class="work-meta">
        <span>${meta}</span>
        ${downloadHtml}
      </div>
    </article>`;
}

function applyDirectory(filePath) {
  const entries = listEntries("directory");
  if (!entries.length) return false;
  const html = fs.readFileSync(filePath, "utf8");
  entries.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const cardsHtml = entries.map(directoryCardHtml).join("\n");
  const result = injectBetweenMarkers(html, "DIRECTORY_ENTRIES", cardsHtml);
  if (result.changed) fs.writeFileSync(filePath, result.html, "utf8");
  return result.changed;
}

function applyPodcast(filePath) {
  const entries = listEntries("podcast");
  if (!entries.length) return false;
  const html = fs.readFileSync(filePath, "utf8");
  entries.sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
  const cardsHtml = entries.map(podcastCardHtml).join("\n");
  const result = injectBetweenMarkers(html, "PODCAST_EPISODES", cardsHtml);
  if (result.changed) fs.writeFileSync(filePath, result.html, "utf8");
  return result.changed;
}

function applyTemplates(filePath) {
  const entries = listEntries("templates_downloads");
  if (!entries.length) return false;
  const html = fs.readFileSync(filePath, "utf8");
  entries.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  const cardsHtml = entries.map(templateCardHtml).join("\n");
  const result = injectBetweenMarkers(html, "TEMPLATE_FILES", cardsHtml);
  if (result.changed) fs.writeFileSync(filePath, result.html, "utf8");
  return result.changed;
}

function main() {
  const settings = loadSettings();
  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));

  let updatedCount = 0;
  for (const file of htmlFiles) {
    if (applySettingsToFile(path.join(ROOT, file), settings)) updatedCount++;
  }
  console.log(`[build] Global Settings applied. Logo: "${settings.logo}". Footer text updated: ${settings.footerText ? "yes" : "no (using page defaults)"}. Files changed: ${updatedCount}/${htmlFiles.length}.`);

  const directoryPath = path.join(ROOT, "directory.html");
  if (fs.existsSync(directoryPath)) {
    const entries = listEntries("directory");
    const changed = applyDirectory(directoryPath);
    console.log(`[build] Directory: ${entries.length} listing(s) found. ${changed ? "Injected into directory.html." : "No injection — empty-state left in place."}`);
  }

  const podcastPath = path.join(ROOT, "podcast.html");
  if (fs.existsSync(podcastPath)) {
    const entries = listEntries("podcast");
    const changed = applyPodcast(podcastPath);
    console.log(`[build] Podcast: ${entries.length} episode(s) found. ${changed ? "Injected into podcast.html." : "No injection — empty-state left in place."}`);
  }

  const templatesPath = path.join(ROOT, "templates.html");
  if (fs.existsSync(templatesPath)) {
    const entries = listEntries("templates_downloads");
    const changed = applyTemplates(templatesPath);
    console.log(`[build] Templates: ${entries.length} file(s) found. ${changed ? "Injected into templates.html." : "No injection — empty-state left in place."}`);
  }
}

main();

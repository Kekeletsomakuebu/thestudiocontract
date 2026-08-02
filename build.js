/**
 * Build step for The Studio Contract.
 *
 * This site has no framework. Instead, this script runs automatically
 * during every Netlify deploy (see netlify.toml) and:
 *
 *   1. Bakes Global Settings, Home, About, and Contact text into their
 *      pages before they're served, by matching element IDs already
 *      in the HTML to values in data/*.json. Doing this at build time
 *      instead of fetching it in the browser means there's no flash of
 *      old content, and it never touches the raw HTML structure the
 *      way editing an .html file directly through Decap used to (that
 *      was overwriting real pages with raw CMS data).
 *
 *   2. Reads Directory, Podcast, and Templates entries Decap CMS has
 *      written (flat-frontmatter .md files) and turns them into the
 *      cards on directory.html, podcast.html, and templates.html.
 *
 *   3. Reads Library — Articles entries the same way, turns them into
 *      cards on articles.html, AND generates a full standalone page
 *      for each article (its markdown body converted to HTML) so
 *      writing an article in /admin actually publishes a real page.
 *
 * Nothing here requires Keke to write or run code by hand. Netlify runs
 * `node build.js` automatically on every push — including pushes made
 * by Decap CMS through Git Gateway when Keke hits "Save" in /admin.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SETTINGS_PATH = path.join(ROOT, "data", "site-settings.json");
const DEFAULT_LOGO_SRC = "assets/logo-nav.png";

const PAGE_HEADER = `<header class="site">
  <nav class="wrap nav">
    <a href="index.html" class="brand">
      <img src="assets/logo-nav.png" alt="The Studio Contract">
    </a>
    <button class="nav-toggle" aria-label="Toggle menu">☰</button>
    <ul class="nav-links">
      <li><a href="index.html">Home</a></li><li><a href="library.html">Library</a><div class="dropdown"><a href="library.html#guides">Guides <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="articles.html">Articles <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="coming-soon.html?s=Stories">Stories <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Case+Studies">Case Studies <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Interviews">Interviews <span class="soon-tag">Soon</span></a><a href="podcast.html">Podcast <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="templates.html">Templates <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="coming-soon.html?s=Checklists">Checklists <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Downloads">Downloads <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Glossary">Glossary <span class="soon-tag">Soon</span></a></div></li><li><a href="resources.html">Resources</a><div class="dropdown"><a href="coming-soon.html?s=Copyright">Copyright <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Publishing">Publishing <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Royalties">Royalties <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Beat+Licensing">Beat Licensing <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Distribution">Distribution <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Music+Marketing">Music Marketing <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Metadata">Metadata <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Finance">Finance <span class="soon-tag">Soon</span></a><a href="coming-soon.html?s=Music+Law">Music Law <span class="soon-tag">Soon</span></a></div></li><li><a href="directory.html">Directory</a><div class="dropdown"><a href="directory.html?cat=Studio">Studios <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="directory.html?cat=Producer">Producers <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="directory.html?cat=Entertainment+Lawyer">Entertainment Lawyers <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="directory.html?cat=Collection+Society">Collection Societies <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="directory.html?cat=Radio+Station">Radio Stations <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="directory.html?cat=Label">Labels <span class="tag-live" style="padding:1px 6px;">Live</span></a><a href="directory.html?cat=Event">Events <span class="tag-live" style="padding:1px 6px;">Live</span></a></div></li><li><a href="podcast.html">Podcast</a></li><li><a href="templates.html">Templates</a></li><li><a href="search.html">Search</a></li><li><a href="about.html">About</a></li>
      <li><a href="contact.html">Contact</a></li>
    </ul>
  </nav>
</header>`;
const PAGE_FOOTER = `<footer class="site">
  <div class="wrap foot-row">
    <span id="footer-text">&copy; 2026 The Studio Contract &middot; Founded by Kekeletso Makuebu &middot; Built for Basotho artists &amp; producers</span>
    <a href="contact.html" id="footer-link">Get in touch</a>
  </div>
</footer>`;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function markdownToHtml(md) {
  if (!md) return "";
  const blocks = md.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("## ")) {
        return `<h2>${escapeHtml(trimmed.slice(3).trim())}</h2>`;
      }
      return `<p>${escapeHtml(trimmed).replace(/\n/g, " ")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.warn(`[build] Could not read ${path.relative(ROOT, filePath)}, skipping. Reason:`, err.message);
    return null;
  }
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

function parseFrontmatterAndBody(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: "" };
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
      value = value.slice(1, -1).replace(/\\(["'])/g, "$1");
    }
    if (key) data[key] = value;
  }
  return { data, body: (match[2] || "").trim() };
}

function listEntries(folderName) {
  const dir = path.join(ROOT, folderName);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data } = parseFrontmatterAndBody(fs.readFileSync(path.join(dir, f), "utf8"));
      return data;
    })
    .filter((entry) => Object.keys(entry).length > 0);
}

function listEntriesWithBody(folderName) {
  const dir = path.join(ROOT, folderName);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, body } = parseFrontmatterAndBody(fs.readFileSync(path.join(dir, f), "utf8"));
      const slug = f.replace(/\.md$/, "");
      return { ...data, _slug: slug, _body: body };
    })
    .filter((entry) => Object.keys(entry).length > 1);
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

function setTextById(html, id, value, opts) {
  opts = opts || {};
  if (value === undefined || value === null || value === "") return html;
  const openMatch = html.match(new RegExp(`<([a-zA-Z0-9]+)[^>]*\\bid="${id}"`));
  if (!openMatch) return html;
  const tagName = openMatch[1];
  const pattern = new RegExp(`(<${tagName}\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</${tagName}>)`);
  if (!pattern.test(html)) return html;
  const content = opts.asHtml ? value : escapeHtml(value);
  return html.replace(pattern, `$1${content}$2`);
}

function setAttrById(html, id, attr, value) {
  if (!value) return html;
  const pattern = new RegExp(`(id="${id}"[^>]*\\s${attr}=")[^"]*(")`);
  if (!pattern.test(html)) return html;
  return html.replace(pattern, `$1${escapeAttr(value)}$2`);
}

function setDisplayById(html, id, show) {
  const pattern = new RegExp(`(id="${id}"[^>]*style="[^"]*display:)(none|block|flex)`);
  if (!pattern.test(html)) return html;
  return html.replace(pattern, `$1${show ? "flex" : "none"}`);
}

function applyHome(filePath) {
  const data = loadJson(path.join(ROOT, "data", "home.json"));
  if (!data) return false;
  let html = fs.readFileSync(filePath, "utf8");
  const before = html;
  html = setTextById(html, "home-kicker", data.kicker);
  html = setTextById(html, "home-title", data.title);
  html = setTextById(html, "home-lede", data.lede);
  html = setAttrById(html, "home-hero-photo", "src", data.hero_photo);
  const changed = html !== before;
  if (changed) fs.writeFileSync(filePath, html, "utf8");
  return changed;
}

function applyAbout(filePath) {
  const data = loadJson(path.join(ROOT, "data", "about.json"));
  if (!data) return false;
  let html = fs.readFileSync(filePath, "utf8");
  const before = html;
  html = setTextById(html, "about-heading", data.heading);
  if (data.body) {
    const bodyHtml = data.body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("\n");
    html = setTextById(html, "about-body", bodyHtml, { asHtml: true });
  }
  const changed = html !== before;
  if (changed) fs.writeFileSync(filePath, html, "utf8");
  return changed;
}

function applyContact(filePath) {
  const data = loadJson(path.join(ROOT, "data", "contact.json"));
  if (!data) return false;
  let html = fs.readFileSync(filePath, "utf8");
  const before = html;
  html = setTextById(html, "contact-heading", data.heading);
  html = setTextById(html, "contact-description", data.description);
  if (data.email) {
    html = setTextById(html, "contact-email-link", data.email);
    html = setAttrById(html, "contact-email-link", "href", `mailto:${data.email}`);
  }
  if (data.instagram_handle) {
    const handle = data.instagram_handle.replace(/^@/, "");
    html = setTextById(html, "contact-instagram-link", `@${handle}`);
    html = setAttrById(html, "contact-instagram-link", "href", `https://instagram.com/${handle}`);
  }
  html = setTextById(html, "contact-location", data.location);
  if (data.phone) {
    html = setTextById(html, "contact-phone-link", data.phone);
    html = setAttrById(html, "contact-phone-link", "href", `tel:${data.phone.replace(/\s+/g, "")}`);
    html = setDisplayById(html, "contact-phone-row", true);
  } else {
    html = setDisplayById(html, "contact-phone-row", false);
  }
  const changed = html !== before;
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

function articleCardHtml(entry) {
  const title = escapeHtml(entry.title || "Untitled article");
  const summary = escapeHtml(entry.summary || "");
  const status = escapeHtml(entry.status || "Article");
  const dateStr = entry.date ? new Date(entry.date).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";
  return `<article class="work" data-type="article">
      <div class="work-top">
        <h3>${title}</h3>
        <span class="work-type">Article</span>
      </div>
      ${summary ? `<p>${summary}</p>` : ""}
      <div class="work-meta">
        <span>${status}${dateStr ? ` &middot; ${dateStr}` : ""}</span>
        <a href="${escapeHtml(entry._slug)}.html">Read online &rarr;</a>
      </div>
    </article>`;
}

function articleDetailHtml(entry) {
  const title = escapeHtml(entry.title || "Untitled article");
  const summary = escapeHtml(entry.summary || "");
  const status = escapeHtml(entry.status || "Article");
  const dateStr = entry.date ? new Date(entry.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const source = entry.source ? escapeHtml(entry.source) : "";
  const bodyHtml = markdownToHtml(entry._body);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — The Studio Contract</title>
<meta name="description" content="${summary}">
<link rel="stylesheet" href="css/style.css">
</head>
<body>
${PAGE_HEADER}

<div class="stripe"><span></span><span></span><span></span></div>

<section class="block wrap">
  <div class="article-shell">
    <div class="article-meta-row"><span>Article</span><span>&middot;</span><span>${status}</span>${dateStr ? `<span>&middot;</span><span>${dateStr}</span>` : ""}</div>
    <h1>${title}</h1>
    ${summary ? `<p class="article-lede">${summary}</p>` : ""}
    <div class="article-body">
${bodyHtml}
    </div>
    ${source ? `<p class="disclaimer">Source: ${source}. This article reflects claims made by the parties involved in an ongoing situation and is not a finding of fact. It is for information only and is not legal advice.</p>` : ""}
  </div>
</section>

${PAGE_FOOTER}

<script src="js/main.js"></script>
</body>
</html>
`;
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

function applyArticlesList(filePath, entries) {
  if (!entries.length) return false;
  const html = fs.readFileSync(filePath, "utf8");
  const cardsHtml = entries.map(articleCardHtml).join("\n");
  const result = injectBetweenMarkers(html, "ARTICLES_LIST", cardsHtml);
  if (result.changed) fs.writeFileSync(filePath, result.html, "utf8");
  return result.changed;
}

function writeArticleDetailPages(entries) {
  let count = 0;
  for (const entry of entries) {
    if (!entry._slug) continue;
    const outPath = path.join(ROOT, `${entry._slug}.html`);
    fs.writeFileSync(outPath, articleDetailHtml(entry), "utf8");
    count++;
  }
  return count;
}

function main() {
  const settings = loadSettings();
  const htmlFiles = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));

  let updatedCount = 0;
  for (const file of htmlFiles) {
    if (applySettingsToFile(path.join(ROOT, file), settings)) updatedCount++;
  }
  console.log(`[build] Global Settings applied. Logo: "${settings.logo}". Footer text updated: ${settings.footerText ? "yes" : "no (using page defaults)"}. Files changed: ${updatedCount}/${htmlFiles.length}.`);

  const homePath = path.join(ROOT, "index.html");
  if (fs.existsSync(homePath)) {
    const changed = applyHome(homePath);
    console.log(`[build] Home: ${changed ? "text applied from data/home.json." : "no changes (using page defaults)."}`);
  }

  const aboutPath = path.join(ROOT, "about.html");
  if (fs.existsSync(aboutPath)) {
    const changed = applyAbout(aboutPath);
    console.log(`[build] About: ${changed ? "text applied from data/about.json." : "no changes (using page defaults)."}`);
  }

  const contactPath = path.join(ROOT, "contact.html");
  if (fs.existsSync(contactPath)) {
    const changed = applyContact(contactPath);
    console.log(`[build] Contact: ${changed ? "text applied from data/contact.json." : "no changes (using page defaults)."}`);
  }

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

  const articlesPath = path.join(ROOT, "articles.html");
  if (fs.existsSync(articlesPath)) {
    const articleEntries = listEntriesWithBody("articles");
    articleEntries.sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
    const changed = applyArticlesList(articlesPath, articleEntries);
    const pagesWritten = writeArticleDetailPages(articleEntries);
    console.log(`[build] Articles: ${articleEntries.length} article(s) found. ${changed ? "Injected into articles.html." : "No injection — empty-state left in place."} ${pagesWritten} detail page(s) generated.`);
  }
}

main();

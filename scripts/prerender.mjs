// Renders every route to its own static HTML file after `vite build`.
// Route list comes from src/routes.tsx, which builds product routes from
// src/data/products.ts. Output layout matches Cloudflare's
// html_handling "auto-trailing-slash": /terma -> terma.html.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const clientDir = join(root, 'dist', 'client');
const templatePath = join(clientDir, 'index.html');

const template = await readFile(templatePath, 'utf8');
if (!template.includes('<!--head-->') || !template.includes('<!--app-->')) {
  throw new Error('dist/client/index.html is missing the <!--head--> or <!--app--> marker. Run `vite build` first.');
}

const { render, pages, siteUrl, legalLastUpdated } = await import(pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href);

const outFile = (path) => {
  if (path === '/') return 'index.html';
  if (path === '/404') return '404.html';
  return `${path.slice(1)}.html`;
};

const written = [];
for (const page of pages) {
  const { html } = render(page.path);
  const doc = template.replace('<!--head-->', page.head).replace('<!--app-->', html);
  // Sanity checks: one title, our own canonical, real content.
  const titles = doc.match(/<title>/g) ?? [];
  if (titles.length !== 1) throw new Error(`${page.path}: expected 1 <title>, found ${titles.length}`);
  if (!/<h1[\s>]/.test(doc)) throw new Error(`${page.path}: no <h1> rendered`);
  const file = join(clientDir, outFile(page.path));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, doc);
  written.push({ path: page.path, file: outFile(page.path), bytes: Buffer.byteLength(doc), title: page.title });
}

// sitemap.xml and robots.txt
const indexable = pages.filter((p) => !p.noindex && p.path !== '/404');
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  indexable.map((p) => `  <url><loc>${siteUrl}${p.path === '/' ? '/' : p.path}</loc></url>`).join('\n') +
  '\n</urlset>\n';
await writeFile(join(clientDir, 'sitemap.xml'), sitemap);
await writeFile(join(clientDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

// Flag owner placeholders still in the copy, e.g. [waktu sokongan].
const pending = new Set();
for (const w of written) {
  const text = (await readFile(join(clientDir, w.file), 'utf8')).replace(/<script[\s\S]*?<\/script>/g, '');
  for (const m of text.matchAll(/\[([^\]<>{}"]{3,60})\]/g)) pending.add(m[1]);
}

console.log('\nPrerendered pages:');
for (const w of written) console.log(`  ${w.path.padEnd(26)} -> ${w.file.padEnd(30)} ${(w.bytes / 1024).toFixed(1).padStart(5)} kB  ${w.title}`);
console.log(`  sitemap.xml (${indexable.length} URLs), robots.txt`);
if (pending.size) {
  console.log('\nPlaceholders still waiting for the owner:');
  for (const p of pending) console.log(`  [${p}]`);
}
if (!legalLastUpdated) {
  console.log('\nLEGAL_LAST_UPDATED is not set (src/data/site.ts). Fill it in at Phase 6, on the day live CHIP keys go on.');
}

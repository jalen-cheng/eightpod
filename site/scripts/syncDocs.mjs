// Builds site/content from the repository's Markdown files, so the docs have one source of truth.
// Copies each page with a title and rewritten links, and copies only the images those pages embed.
// Run by `npm run build` and `npm run dev`; the output is not committed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOSITORY_URL, generatedPages, handWrittenPages } from './docsManifest.mjs';
import { rewriteMarkdown } from './rewriteLinks.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(siteRoot, '..');
const contentRoot = path.join(siteRoot, 'content');

// 'file', 'directory' or null for a path relative to the repository root.
function exists(repositoryPath) {
  try {
    return fs.statSync(path.join(repositoryRoot, repositoryPath)).isDirectory() ? 'directory' : 'file';
  } catch {
    return null;
  }
}

// Copies a file, creating its folder first.
function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

// Page title: the file's first top-level heading.
function titleOf(markdown, sourcePath) {
  const heading = markdown.match(/^# (.+)$/m);
  if (!heading) throw new Error(`${sourcePath} has no "# " heading to use as its title`);
  return heading[1].trim();
}

// Front matter: the title for the browser tab, and the source file for the "Edit this page" link.
function frontMatter(title, sourcePath) {
  return `---\ntitle: ${JSON.stringify(title)}\nsource: ${JSON.stringify(sourcePath)}\n---\n\n`;
}

fs.rmSync(contentRoot, { recursive: true, force: true });
fs.mkdirSync(contentRoot, { recursive: true });

const context = {
  pagesBySource: new Map(generatedPages.map((page) => [page.source, page])),
  repositoryUrl: REPOSITORY_URL,
  images: new Set(),
  exists,
};

for (const page of generatedPages) {
  const markdown = fs.readFileSync(path.join(repositoryRoot, page.source), 'utf8');
  const body = rewriteMarkdown(markdown, page.source, context);
  const content = frontMatter(titleOf(markdown, page.source), page.source) + body;
  fs.writeFileSync(path.join(contentRoot, `${page.slug}.md`), content);
}

for (const page of handWrittenPages) {
  copyFile(path.join(siteRoot, 'pages', page.file), path.join(contentRoot, page.file));
}

for (const image of context.images) {
  copyFile(path.join(repositoryRoot, image), path.join(contentRoot, 'images', image));
}

// The site logo and favicon are the app's own icon, not a second copy in git.
copyFile(path.join(repositoryRoot, 'app/public/sevensleep-icon.svg'), path.join(contentRoot, 'public/logo.svg'));

console.log(`Synced ${generatedPages.length} pages and ${context.images.size} images into site/content`);

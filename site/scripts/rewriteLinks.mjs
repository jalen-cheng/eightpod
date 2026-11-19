// Rewrites the links and image paths in one Markdown file so they work on the site.
// Pure functions, no file writes: the sync script decides what to copy.
import path from 'node:path';

// Matches "![alt](target)" (an image) or "](target)" (the end of a link, which may wrap an image).
const MARKDOWN_TARGET = /(!\[[^\]]*)?\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;
const HTML_TARGET = /\b(href|src)="([^"]+)"/g;
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|svg|webp)$/i;

// True for targets that need no rewriting: web addresses, mail links and in-page anchors.
function isExternal(target) {
  return /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);
}

// Splits "path#anchor" into its two parts.
function splitAnchor(target) {
  const hashIndex = target.indexOf('#');
  return hashIndex === -1
    ? { filePath: target, anchor: '' }
    : { filePath: target.slice(0, hashIndex), anchor: target.slice(hashIndex) };
}

/**
 * Decides where one link target should point.
 * - Another generated page: its site address.
 * - An embedded image (image syntax or src=): a copy under images/, recorded in `context.images`.
 * - Anything else in the repository: its GitHub page.
 * `context` supplies: pagesBySource (Map), repositoryUrl, images (Set) and
 * exists(repositoryPath), which returns 'file', 'directory' or null.
 */
export function resolveTarget(target, sourcePath, isEmbeddedImage, context) {
  if (isExternal(target)) return target;
  const { filePath, anchor } = splitAnchor(target);
  const repositoryPath = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), filePath));
  const kind = context.exists(repositoryPath);
  if (!kind) throw new Error(`${sourcePath}: link target "${target}" does not exist (${repositoryPath})`);

  const page = context.pagesBySource.get(repositoryPath);
  if (page) return `./${page.slug}${anchor}`;

  if (isEmbeddedImage && IMAGE_EXTENSION.test(repositoryPath)) {
    context.images.add(repositoryPath);
    return `./images/${repositoryPath}`;
  }
  const view = kind === 'directory' ? 'tree' : 'blob';
  return `${context.repositoryUrl}/${view}/main/${repositoryPath}${anchor}`;
}

// Rewrites the targets on one line of prose (inline code spans are left alone).
function rewriteLine(line, sourcePath, context) {
  return line
    .split(/(`[^`]*`)/)
    .map((segment) => {
      if (segment.startsWith('`')) return segment;
      return segment
        .replace(MARKDOWN_TARGET, (match, imageStart, target, title) => {
          const resolved = resolveTarget(target, sourcePath, Boolean(imageStart), context);
          return `${imageStart ?? ''}](${resolved}${title})`;
        })
        .replace(HTML_TARGET, (match, attribute, target) => {
          return `${attribute}="${resolveTarget(target, sourcePath, attribute === 'src', context)}"`;
        });
    })
    .join('');
}

// Rewrites a whole Markdown file, skipping fenced code blocks.
export function rewriteMarkdown(markdown, sourcePath, context) {
  let insideFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        insideFence = !insideFence;
        return line;
      }
      return insideFence ? line : rewriteLine(line, sourcePath, context);
    })
    .join('\n');
}

import { defineConfig } from 'vitepress';
import { REPOSITORY_URL, sidebarGroups } from '../scripts/docsManifest.mjs';

// GitHub's way of turning a heading into a link target: lower case, punctuation dropped, each
// space a dash. The Markdown files link to each other's headings in that form, so the site
// uses it too and those links land where they do on GitHub.
const slugifyLikeGitHub = (heading: string): string => heading
  .trim()
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s_-]/gu, '')
  .replace(/\s/g, '-');

// The sidebar follows the groups in scripts/docsManifest.mjs.
const sidebar = sidebarGroups.map((group) => ({
  text: group.text,
  items: group.pages.map((page) => ({ text: page.title, link: `/${page.slug}` })),
}));

export default defineConfig({
  title: 'SevenSleep',
  description: 'Documentation for SevenSleep, subscription-free local control for Eight Sleep Pods.',
  srcDir: 'content',
  base: '/sevensleep/',
  cleanUrls: true,
  appearance: 'force-dark',
  markdown: {
    anchor: { slugify: slugifyLikeGitHub },
    headers: { slugify: slugifyLikeGitHub },
    toc: { slugify: slugifyLikeGitHub },
  },
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/sevensleep/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Getting started', link: '/getting-started' },
      { text: 'Demo', link: 'https://sevensleep.vercel.app' },
    ],
    sidebar,
    socialLinks: [{ icon: 'github', link: REPOSITORY_URL }],
    // Generated pages point back at the repository file they were built from. The function is
    // serialised into the browser bundle, so it cannot use variables from this file.
    editLink: {
      pattern: ({ frontmatter }) =>
        `https://github.com/jalen-cheng/sevensleep/edit/main/${frontmatter.source ?? 'site/pages/getting-started.md'}`,
      text: 'Edit this page on GitHub',
    },
    outline: { level: [2, 3] },
    search: { provider: 'local' },
    footer: {
      message: 'An independent project. Not affiliated with, endorsed by or supported by Eight Sleep.',
    },
  },
});

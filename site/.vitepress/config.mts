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

// Where the site is served from on GitHub Pages, and the page its address opens
const BASE_PATH = '/sevensleep/';
const FIRST_PAGE = 'getting-started';

// The sidebar follows the groups in scripts/docsManifest.mjs.
// On a phone the top bar's own menu is hidden (custom.css), so the links it held are here too
const sidebar = [
  ...sidebarGroups.map((group) => ({
    text: group.text,
    items: group.pages.map((page) => ({ text: page.title, link: `/${page.slug}` })),
  })),
  { text: 'Elsewhere', items: [{ text: 'Demo', link: 'https://sevensleep.vercel.app' }, { text: 'GitHub', link: REPOSITORY_URL }] },
];

export default defineConfig({
  title: 'SevenSleep',
  description: 'Documentation for SevenSleep, subscription-free local control for Eight Sleep Pods.',
  srcDir: 'content',
  base: BASE_PATH,
  cleanUrls: true,
  appearance: 'force-dark',
  markdown: {
    anchor: { slugify: slugifyLikeGitHub },
    headers: { slugify: slugifyLikeGitHub },
    toc: { slugify: slugifyLikeGitHub },
  },
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE_PATH}logo.svg` }]],
  // There is no landing page: the root address sends the browser on to the first page
  transformPageData(pageData) {
    if (pageData.relativePath !== 'index.md') return;
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(['meta', { 'http-equiv': 'refresh', content: `0; url=${BASE_PATH}${FIRST_PAGE}` }]);
  },
  themeConfig: {
    // The name as lettering stands in for the title beside it
    logo: { light: '/wordmark-on-light.png', dark: '/wordmark-on-dark.png', alt: 'SevenSleep' },
    siteTitle: false,
    // Unlike the links below, VitePress uses this one as written, so it carries the base path
    logoLink: `${BASE_PATH}${FIRST_PAGE}`,
    nav: [
      { text: 'Getting started', link: `/${FIRST_PAGE}` },
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

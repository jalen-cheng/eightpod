import { defineConfig } from 'vitepress';
import { REPOSITORY_URL, sidebarGroups } from '../scripts/docsManifest.mjs';

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

// The documentation pages built from the repository's Markdown files, and how the sidebar groups them.
// `source` is the file's path from the repository root; `slug` is its address on the site.
// Shared by the sync script (which copies the files) and the VitePress config (which builds the sidebar).

export const REPOSITORY_URL = 'https://github.com/jalen-cheng/sevensleep';

// Hand-written pages that live in site/pages (not generated from a repository file).
export const handWrittenPages = [{ file: 'index.md' }, { file: 'getting-started.md' }];

export const sidebarGroups = [
  {
    text: 'Start',
    pages: [
      { slug: 'getting-started', title: 'Getting started' },
      { slug: 'install', title: 'Install', source: 'INSTALLATION.md' },
      { slug: 'pod-models', title: 'Compatibility', source: 'docs/POD_MODELS.md' },
    ],
  },
  {
    text: 'Use',
    pages: [
      { slug: 'using', title: 'Using the app', source: 'docs/USING.md' },
      { slug: 'autopilot', title: 'Autopilot', source: 'docs/AUTOPILOT.md' },
      { slug: 'connections', title: 'Connections', source: 'docs/CONNECTIONS.md' },
      { slug: 'ios-shortcuts', title: 'iPhone Shortcuts', source: 'docs/IOS_SHORTCUTS.md' },
      { slug: 'remote-access', title: 'Remote access', source: 'docs/REMOTE_ACCESS.md' },
    ],
  },
  {
    text: 'Reference',
    pages: [
      { slug: 'how-it-works', title: 'How it works', source: 'docs/HOW_IT_WORKS.md' },
      { slug: 'api', title: 'API', source: 'server/API.md' },
      { slug: 'changelog', title: 'Changelog', source: 'CHANGELOG.md' },
    ],
  },
  {
    text: 'Contribute',
    pages: [
      { slug: 'developing', title: 'Developing', source: 'DEVELOPING.md' },
      { slug: 'contributing', title: 'Contributing', source: 'CONTRIBUTING.md' },
    ],
  },
];

// Every page that is generated from a repository file.
export const generatedPages = sidebarGroups.flatMap((group) => group.pages).filter((page) => page.source);

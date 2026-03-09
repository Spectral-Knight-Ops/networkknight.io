// @ts-check
import { themes as prismThemes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'NetworkKnight',
  tagline: 'Cybersecurity Knowledge Base',
  favicon: 'img/knight-split-logo.png',

  // GitHub Pages deployment config
  url: 'https://networkknight.io',
  baseUrl: '/',

  // GitHub Pages config — 
  organizationName: 'Spectral-Knight-Ops', 
  projectName: 'networkknight.io',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  
  plugins: [
    require.resolve('docusaurus-lunr-search'),
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/', // Docs as the landing page (no separate homepage)
        },
        blog: {
          showReadingTime: true,
          blogTitle: 'Blog',
          blogDescription: 'Articles and writeups from NetworkKnight',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: 'Network Knight',
        logo: {
          alt: 'Network Knight Logo',
          src: 'img/knight-split-logo.png',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'mainSidebar',
            position: 'left',
            label: 'Knowledge Base',
          },
          { to: '/blog', label: 'Blog', position: 'left' },
          {
            href: 'https://github.com/Spectral-Knight-Ops', 
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Knowledge Base',
            items: [
              { label: 'Red Teaming', to: '/red-teaming/methodology' },
              { label: 'Defensive', to: '/defensive/siem/elastic/elastic' },
              { label: 'Projects', to: '/projects/honeypot/honeypot' },
            ],
          },
          {
            title: 'More',
            items: [
              { label: 'Blog', to: '/blog' },
              { label: 'GitHub', href: 'https://github.com/Spectral-Knight-Ops' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} NetworkKnight. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['powershell', 'bash', 'python', 'csharp', 'sql', 'json', 'ini'],
      },
    }),
};

export default config;

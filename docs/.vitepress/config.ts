import { URL, fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vitepress'
import { useSidebar } from 'vitepress-openapi'
import { SitemapStream } from 'sitemap'
import { createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import spec from '../public/openapi.json' with { type: 'json' }

const links = []

const env = loadEnv('', process.cwd())

const gTag = env.VITE_GTAG

const sidebar = useSidebar({ spec })

function addDocsPrefix(group: string) {
  return {
    ...group,
    items: group.items.map((item) => {
      return {
        ...item,
        link: `/docs${item.link}`,
      }
    }),
  }
}

export default defineConfig({
  title: 'ArgentinaDatos API',
  description: 'API para diferentes datos de Argentina',

  themeConfig: {
    logo: '/assets/logo.webp',
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/enzonotario/esjs-argentina-datos-api',
      },
    ],
    outline: [1, 3],
    sidebar: [
      {
        text: `<span class="OASidebarItem">
        <svg class="i-mdi-book-open-page-variant w-5 h-5" />
        <span class="OASidebarItem-text">Introducción</span>
      </span>`,
        link: '/docs',
      },
      {
        text: `<span class="OASidebarItem">
        <svg class="i-mdi-github w-5 h-5" />
        <span class="OASidebarItem-text">GitHub</span>
      </span>`,
        link: 'https://github.com/enzonotario/esjs-argentina-datos-api',
      },
      {
        text: 'Eventos',
        items: [
          addDocsPrefix(
            sidebar.generateSidebarGroup({
              tag: 'Eventos',
              text: '',
            }),
          ),
        ],
      },
      {
        text: 'Cotizaciones históricas',
        items: [
          addDocsPrefix(
            sidebar.generateSidebarGroup({
              tag: 'Cotizaciones históricas',
              text: '',
            }),
          ),
        ],
      },
      {
        text: 'Cotización actual',
        items: [
          {
            items: [
              {
                text: `<span class="OASidebarItem">
              <svg class="i-mdi-currency-usd w-5 h-5" />
              <span class="OASidebarItem-text">DolarApi</span> 
              </span>`,
                link: 'https://dolarapi.com/',
              },
            ],
          },
        ],
      },

      {
        text: 'Finanzas',
        items: [
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Finanzas', 'Índices'],
              text: 'Índices',
            }),
            collapsed: true,
          }),
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Finanzas', 'Tasas'],
              text: 'Tasas',
            }),
            collapsed: true,
          }),
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Finanzas', 'Créditos'],
              text: 'Créditos',
            }),
            collapsed: true,
          }),
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Finanzas', 'Rendimientos'],
              text: 'Rendimientos',
            }),
            collapsed: true,
          }),
          addDocsPrefix({
            text: 'FCI',
            items: [
              ...sidebar.generateSidebarGroup({
                tag: ['Finanzas', 'FCI'],
              }).items,
              addDocsPrefix({
                text: 'Detalles',
                items: [
                  ...sidebar.generateSidebarGroup({
                    tag: ['Finanzas', 'FCI Detalles'],
                  }).items,
                ],
              }),
            ],
            collapsed: true,
          }),
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Finanzas', 'Remesas'],
              text: 'Remesas',
            }),
            collapsed: true,
          }),
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Finanzas', 'Cobros'],
              text: 'Cobros',
            }),
            collapsed: true,
          }),
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Finanzas', 'REM'],
              text: 'REM',
            }),
            collapsed: true,
          }),
        ],
      },
      {
        text: 'Política',
        items: [
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Política', 'Índices'],
              text: 'Índices',
            }),
            collapsed: true,
          }),
        ],
      },
      {
        text: 'Congreso',
        items: [
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Congreso', 'Senado'],
              text: 'Senado',
            }),
            collapsed: true,
          }),
          addDocsPrefix({
            ...sidebar.generateSidebarGroup({
              tag: ['Congreso', 'Diputados'],
              text: 'Diputados',
            }),
            collapsed: true,
          }),
        ],
      },
      {
        text: 'Historia',
        items: [
          addDocsPrefix(
            sidebar.generateSidebarGroup({
              tag: 'Historia',
              text: '',
            }),
          ),
        ],
      },
      {
        text: 'API',
        items: [
          addDocsPrefix(
            sidebar.generateSidebarGroup({
              tag: 'API',
              text: '',
            }),
          ),
        ],
      },
    ],
    nav: [{ text: 'Sponsors', link: '/docs/sponsors' }],
    footer: {
      message:
        'Liberado bajo la <a href="https://github.com/enzonotario/esjs-argentina-datos-api/blob/main/LICENSE">Licencia MIT</a>.',
      copyright: '<a href="/docs/legal">Aviso Legal</a>',
    },
    search: {
      provider: 'algolia',
      options: {
        appId: 'UNH9XU8JKG',
        apiKey: '11a8390143d57724a4fd9b8b120899ce',
        indexName: 'argentinadatos',
      },
    },
  },

  head: [
    // Google Analytics
    [
      'script',
      { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${gTag}` },
    ],
    [
      'script',
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gTag}');`,
    ],

    // Favicon
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./', import.meta.url)),
      },
    },
  },

  /**
   * Sitemap generation
   */
  cleanUrls: false,
  transformHtml: (_, id, { pageData }) => {
    if (!/[\\/]404\.html$/.test(id)) {
      links.push({
        /* conatins index.md? */
        url: pageData.relativePath.endsWith('index.md')
          ? '/'
          : `${pageData.relativePath.replace(
              /((^|\/)index)?\.md$/,
              '$2',
            )}.html`,
        lastmod: pageData.lastUpdated,
      })
    }
  },
  buildEnd: async ({ outDir }) => {
    const sitemap = new SitemapStream({
      hostname: 'https://argentinadatos.com/docs/',
    })
    const writeStream = createWriteStream(resolve(outDir, 'sitemap.xml'))
    sitemap.pipe(writeStream)
    links.forEach(link => sitemap.write(link))
    sitemap.end()
    await new Promise(resolve => writeStream.on('finish', resolve))
  },

  rewrites: {
    '/docs/operations/get-finanzas-hipotecarios-uva.html':
      '/docs/operations/get-finanzas-creditos-hipotecarios-uva.html',
    '/docs/operations/get-finanzas-hipotecarios-uva':
      '/docs/operations/get-finanzas-creditos-hipotecarios-uva.html',
  },

  transformPageData(pageData) {
    const pageTitle = pageData.params?.pageTitle

    if (pageTitle) {
      pageData.title = pageTitle
      pageData.frontmatter ??= {}
      pageData.frontmatter.title = pageTitle
    }
  },
})

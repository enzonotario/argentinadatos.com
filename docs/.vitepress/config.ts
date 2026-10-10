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
      if (!item.link) return item
      return {
        ...item,
        link: `/docs${item.link}`,
      }
    }),
  }
}

function itemsByOperationId(tag: string | string[]) {
  const group = sidebar.generateSidebarGroup({ tag, text: '' })
  return new Map(
    group.items.map(item => [item.link?.split('/').pop(), item]),
  )
}

function takeItems(
  items: Map<string | undefined, { link?: string }>,
  ids: string[],
) {
  return ids.map((id) => {
    const item = items.get(id)
    if (!item) throw new Error(`Falta el ítem de sidebar ${id}`)
    items.delete(id)
    return item
  })
}

function subgroup(text: string, items: { link?: string }[]) {
  return {
    text,
    items: items.map(item => ({
      ...item,
      link: `/docs${item.link}`,
    })),
  }
}

function congresoGroup(
  text: string,
  tag: string,
  sections: { text?: string, ids: string[] }[],
) {
  const items = itemsByOperationId(['Congreso', tag])
  const built = []

  for (const section of sections) {
    const picked = takeItems(items, section.ids)
    if (section.text) built.push(subgroup(section.text, picked))
    else built.push(...picked)
  }

  if (items.size > 0) {
    throw new Error(
      `${text}: operaciones sin grupo: ${[...items.keys()].join(', ')}`,
    )
  }

  return addDocsPrefix({
    text,
    collapsed: true,
    items: built,
  })
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
              tag: ['Finanzas', 'Cauciones'],
              text: 'Cauciones',
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
              tag: ['Finanzas', 'Bonos'],
              text: 'Bonos',
            }),
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
              tag: ['Finanzas', 'Brokers'],
              text: 'Brokers',
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
          congresoGroup('Senado', 'Senado', [
            {
              ids: [
                'get-senado-senadores',
                'get-senado-senadores-dietas-mecanismos',
                'get-senado-presidencia',
              ],
            },
            {
              text: 'Bloques',
              ids: ['get-senado-bloques', 'get-senado-bloques-id'],
            },
            {
              text: 'Gasto',
              ids: [
                'get-senado-escala-salarial',
                'get-senado-gasto',
                'get-senado-senadores-id-personal',
              ],
            },
            {
              text: 'Comisiones',
              ids: [
                'get-senado-comisiones',
                'get-senado-comisiones-id',
                'get-senado-senadores-id-comisiones',
              ],
            },
            {
              text: 'Viajes',
              ids: [
                'get-senado-viajes',
                'get-senado-viajes-nacionales',
                'get-senado-viajes-nacionales-año',
                'get-senado-viajes-nacionales-año-mes',
                'get-senado-viajes-internacionales',
                'get-senado-viajes-internacionales-año',
                'get-senado-viajes-conteo',
                'get-senado-viajes-conteo-12m',
                'get-senado-senadores-id-viajes',
              ],
            },
            {
              text: 'Actas',
              ids: ['get-senado-actas-año', 'get-senado-actas'],
            },
          ]),
          congresoGroup('Diputados', 'Diputados', [
            {
              ids: ['get-diputados-diputados', 'get-diputados-recinto'],
            },
            {
              text: 'Períodos',
              ids: [
                'get-diputados-periodos',
                'get-diputados-periodos-lista',
              ],
            },
            {
              text: 'Comisiones',
              ids: [
                'get-diputados-comisiones',
                'get-diputados-comision',
                'get-diputados-diputado-comisiones',
              ],
            },
            {
              text: 'Misiones',
              ids: [
                'get-diputados-misiones',
                'get-diputados-misiones-lista',
                'get-diputados-misiones-año',
                'get-diputados-diputado-misiones',
              ],
            },
            {
              text: 'Viajes',
              ids: [
                'get-diputados-viajes',
                'get-diputados-viajes-nacionales',
                'get-diputados-viajes-conteo-12m',
                'get-diputados-viajes-conteo',
                'get-diputados-diputado-viajes',
              ],
            },
            {
              text: 'Actas',
              ids: ['get-diputados-actas-año', 'get-diputados-actas'],
            },
          ]),
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

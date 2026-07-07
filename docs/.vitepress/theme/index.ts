import { generateCodeSample, theme, useOpenapi, useTheme } from 'vitepress-openapi/client'
import DefaultTheme from 'vitepress/theme'
import { setDefaultOptions } from 'date-fns'
import { es } from 'date-fns/locale'
import { h } from 'vue'
import spec from '../../public/openapi.json' with { type: 'json' }
import { useECharts } from '../plugins/echarts'
import chartComponents from './components/charts'
import CustomLayout from './CustomLayout.vue'
import SponsorsAvatars from './components/sponsors/SponsorsAvatars.vue'
import MarkdownLink from './components/MarkdownLink.vue'
import DataSources from './components/DataSources.vue'

import 'vitepress-openapi/dist/style.css'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: CustomLayout,
  enhanceApp({ app }) {
    setDefaultOptions({ locale: es })

    const defaultLanguages = useTheme().getCodeSamplesAvailableLanguages()

    const openapi = useOpenapi({
      spec,
      config: {
        i18n: {
          locale: 'es',
        },
        codeSamples: {
          defaultLang: 'url',
          availableLanguages: [
            {
              lang: 'url',
              label: 'URL',
              highlighter: 'plain',
            },
            ...defaultLanguages,
          ],
          generator: async (langConfig, request) => {
            if (langConfig.lang === 'url') {
              return request.url.href
            }

            if (langConfig.lang === 'curl') {
              return `curl -L '${request.url}'`
            }

            return generateCodeSample(langConfig, request)
          },
        },
      },
    })

    theme.enhanceApp({ app, openapi })

    app.use(useECharts)
    for (const [name, component] of Object.entries(chartComponents))
      app.component(name, component)

    app.component('SponsorsAvatars', SponsorsAvatars)
    app.component('MarkdownLink', MarkdownLink)
    app.component('DataSources', DataSources)
  },
}

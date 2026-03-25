import { generateCodeSample, theme, useOpenapi } from 'vitepress-openapi/client'
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

    const openapi = useOpenapi({
      spec,
      config: {
        i18n: {
          locale: 'es',
        },
        codeSamples: {
          generator: async (lang, request) => {
            if (lang === 'curl') {
              return `curl -L '${request.url}'`
            }

            return generateCodeSample(lang, request)
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

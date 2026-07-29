import { computed } from 'vue'
import { useDark, useECharts } from '@pureadmin/utils'

export const useEcharts = (chartRef) => {
  const { isDark } = useDark()

  const theme = computed(() => {
    return isDark.value ? 'dark' : 'default'
  })

  const { setOptions, getInstance } = useECharts(chartRef, { theme, renderer: 'svg' })

  return {
    setOptions,
    getInstance,
    theme,
  }
}

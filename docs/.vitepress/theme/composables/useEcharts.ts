import { computed } from 'vue'
import { useDark, useECharts } from '@pureadmin/utils'
import { normalizeEchartsOptionColors } from '../utils/toEchartsColor'

export const useEcharts = (chartRef) => {
  const { isDark } = useDark()

  const theme = computed(() => {
    return isDark.value ? 'dark' : 'default'
  })

  const { setOptions: setOptionsRaw, getInstance } = useECharts(chartRef, {
    theme,
    renderer: 'svg',
  })

  const setOptions = (options: unknown, ...rest: unknown[]) => {
    return setOptionsRaw(normalizeEchartsOptionColors(options) as any, ...rest as any)
  }

  return {
    setOptions,
    getInstance,
    theme,
  }
}

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { useEcharts } from '../../composables/useEcharts'

interface TrendPoint {
  label: string
  value: number
}

const props = defineProps<{
  indicador: string
  periodoTipo: string
  unidad?: string | null
  participantes?: number | null
  puntos: TrendPoint[]
}>()

const chartRef = ref()
const { setOptions, theme } = useEcharts(chartRef)

const categorias = computed(() => props.puntos.map(p => p.label))
const valores = computed(() => props.puntos.map(p => p.value))

async function setChartOptions() {
  const sinDatos = props.puntos.length === 0
  if (sinDatos) {
    setOptions({
      title: {
        text: 'Sin serie disponible',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: theme.value === 'dark' ? colors.gray[300] : colors.gray[600],
          fontSize: 12,
        },
      },
    } as any)
    return
  }

  const chartType = props.puntos.length <= 2 ? 'bar' : 'line'

  setOptions({
    grid: { left: 12, right: 12, top: 18, bottom: 24, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const point = params[0]
        if (!point)
          return ''
        const val = Number(point.value)
        const valor = Number.isInteger(val)
          ? val.toLocaleString('es-AR')
          : val.toLocaleString('es-AR', { maximumFractionDigits: 2 })
        return `${point.axisValue}<br><b>${valor}</b>${props.unidad ? ` ${props.unidad}` : ''}`
      },
    },
    xAxis: {
      type: 'category',
      data: categorias.value,
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[200] : colors.gray[700],
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[200] : colors.gray[700],
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: theme.value === 'dark' ? colors.gray[800] : colors.gray[200],
        },
      },
    },
    series: [
      {
        name: props.indicador,
        type: chartType,
        data: valores.value,
        smooth: chartType === 'line',
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: colors.indigo[500] },
        lineStyle: { width: 2 },
      },
    ],
  } as any)
}

onMounted(async () => {
  await nextTick()
  await setChartOptions()
})

watch([() => props.puntos, theme], async () => {
  await nextTick()
  await setChartOptions()
}, { deep: true })
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <p class="line-clamp-2 text-sm font-medium text-gray-700 dark:text-gray-200">
      {{ indicador }}
    </p>
    <div class="mt-1 flex flex-wrap gap-2 text-xs">
      <span class="rounded bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
        {{ periodoTipo || 'n/a' }}
      </span>
      <span class="rounded bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
        n={{ participantes ?? '—' }}
      </span>
      <span v-if="unidad" class="rounded bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
        {{ unidad }}
      </span>
    </div>
    <div ref="chartRef" class="mt-2 h-44" />
  </div>
</template>

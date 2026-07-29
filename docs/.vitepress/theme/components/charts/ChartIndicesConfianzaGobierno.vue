<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const chartRef = ref()

const { setOptions, theme } = useEcharts(chartRef)

const api = useApi()

watch(theme, async () => {
  await setChartOptions()
})

async function fetchData() {
  try {
    return await api.get('/politica/indices/confianza-gobierno')
  }
  catch (error) {
    return []
  }
}

async function setChartOptions() {
  const seriesData = await fetchData()

  setOptions({
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: (params: any) => {
        const date = params[0].axisValue
        const dataIndex = seriesData.findIndex(item => item.fecha === date)
        const currentItem = seriesData[dataIndex]
        const prevItem = seriesData[dataIndex - 1]

        if (!currentItem) {
          return ''
        }

        const currentValor = currentItem.valor
        const prevValor = prevItem?.valor || currentValor
        const variacion = currentItem.variacion ?? (currentValor - prevValor)
        const variacionPorcentaje = currentItem.variacion != null
          ? (currentItem.variacion * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : prevValor !== 0
            ? ((variacion / prevValor) * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '0,00'
        const isSubida = variacion > 0
        const variacionColor = isSubida ? colors.green[500] : colors.red[500]
        const variacionSigno = isSubida ? '+' : ''

        return `<div class="flex flex-col gap-1">
          <div class="font-semibold">${format(parseISO(date), 'MMMM yyyy', { locale: es })}</div>
          <div class="flex items-center gap-2">
            <span>ICG:</span>
            <span class="font-bold">${currentValor.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
          </div>
          ${prevItem ? `
            <div class="flex items-center gap-2">
              <span>Variación:</span>
              <span class="font-bold" style="color: ${variacionColor}">
                ${variacionSigno}${variacionPorcentaje}%
              </span>
            </div>
            <div class="text-xs text-gray-500">
              vs. mes anterior: ${prevValor.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
            </div>
          ` : ''}
        </div>`
      },
    },
    legend: {
      left: 'left',
      data: ['ICG'],
      textStyle: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
      },
    },
    toolbox: {
      top: 20,
      right: 10,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
        },
        restore: {},
        saveAsImage: {},
      },
    },
    series: [
      {
        name: 'ICG',
        type: 'line',
        data: seriesData.map(item => item.valor),
        itemStyle: {
          color: colors.sky[500],
        },
        lineStyle: {
          width: 2,
        },
        symbol: 'circle',
        symbolSize: 4,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14, 165, 233, 0.25)' },
              { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
            ],
          },
        },
      },
    ],
    xAxis: {
      type: 'category',
      data: seriesData.map(item => item.fecha),
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        formatter: (value: string) => {
          return format(parseISO(value), 'MM/yyyy')
        },
        rotate: 45,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        formatter: (value: number) => {
          return value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        },
      },
    },
    dataZoom: [
      {
        type: 'slider',
        start: 70,
        end: 100,
        handleSize: '80%',
        handleStyle: {
          color: colors.sky[500],
        },
      },
      {
        type: 'inside',
        start: 70,
        end: 100,
      },
    ],
  } as any)
}

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div>
    <h3>Índice de Confianza en el Gobierno (ICG)</h3>

    <div ref="chartRef" class="h-[50rem]" />
  </div>
</template>

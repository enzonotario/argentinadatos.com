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
    const data = await api.get('/finanzas/indices/uva')

    return data
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
        const value = params[0].value
        const dataIndex = seriesData.findIndex(item => item.fecha === date)
        const currentItem = seriesData[dataIndex]
        const prevItem = seriesData[dataIndex - 1]

        if (!currentItem) {
          return ''
        }

        const currentValor = currentItem.valor
        const prevValor = prevItem?.valor || currentValor
        const variacion = currentValor - prevValor
        const variacionPorcentaje = prevValor !== 0
          ? ((variacion / prevValor) * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '0,00'
        const isSubida = variacion > 0
        const variacionColor = isSubida ? colors.green[500] : colors.red[500]
        const variacionSigno = isSubida ? '+' : ''

        return `<div class="flex flex-col gap-1">
          <div class="font-semibold">${format(parseISO(date), 'dd/MM/yyyy', { locale: es })}</div>
          <div class="flex items-center gap-2">
            <span>UVA:</span>
            <span class="font-bold">$${currentValor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ${prevItem ? `
            <div class="flex items-center gap-2">
              <span>Variación:</span>
              <span class="font-bold" style="color: ${variacionColor}">
                ${variacionSigno}$${variacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                (${variacionSigno}${variacionPorcentaje}%)
              </span>
            </div>
            <div class="text-xs text-gray-500">
              vs. día anterior: $${prevValor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          ` : ''}
        </div>`
      },
    },
    legend: {
      left: 'left',
      data: ['Valor'],
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
        name: 'Valor',
        type: 'line',
        data: seriesData.map(item => item.valor),
        itemStyle: {
          color: colors.indigo[500],
        },
        lineStyle: {
          width: 2,
        },
        symbol: 'circle',
        symbolSize: 4,
      },
    ],
    xAxis: {
      type: 'category',
      data: seriesData.map(item => item.fecha),
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        formatter: (value: string) => {
          return format(parseISO(value), 'dd/MM/yyyy')
        },
        rotate: 45,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        formatter: (value: number) => {
          return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        },
      },
    },
    dataZoom: [
      {
        type: 'slider',
        start: 95,
        end: 100,
        handleSize: '80%',
        handleStyle: {
          color: colors.indigo[500],
        },
      },
      {
        type: 'inside',
        start: 95,
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
    <h3>Índices UVA</h3>

    <div ref="chartRef" class="h-[50rem]" />
  </div>
</template>

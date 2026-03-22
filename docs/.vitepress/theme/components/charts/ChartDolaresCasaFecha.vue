<script setup lang="ts">
import { ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { format, parseISO, subDays } from 'date-fns'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const chartRef = ref()

const { setOptions, theme } = useEcharts(chartRef)

const api = useApi()

const casa = ref('blue')

const options = [
  {
    value: 'oficial',
    name: 'Oficial',
  },
  {
    value: 'blue',
    name: 'Blue',
  },
  {
    value: 'bolsa',
    name: 'Bolsa',
  },
  {
    value: 'contadoconliqui',
    name: 'Contado con liquidación',
  },
  {
    value: 'mayorista',
    name: 'Mayorista',
  },
  {
    value: 'cripto',
    name: 'Cripto',
  },
  {
    value: 'tarjeta',
    name: 'Tarjeta',
  },
  {
    value: 'solidario',
    name: 'Solidario',
  },
]

async function fetchDolares(casa: string) {
  try {
    return Promise.all(
      Array.from({ length: 7 }).map(async (_, index) => {
        const date = format(subDays(new Date(), index + 1), 'yyyy/MM/dd')

        const dolares = await api.get(`/cotizaciones/dolares/${casa}/${date}`)

        return dolares
      }),
    )
  }
  catch (error) {
    return []
  }
}

async function setChartOptions(casa: string) {
  const dolares = (await fetchDolares(casa)).reverse()

  dolares.forEach((dolar, index) => {
    if (index === 0) {
      dolar.variacion = 0
    }
    else {
      dolar.variacion = Number(dolar.venta - dolares[index - 1].venta).toFixed(
        2,
      )
    }
  })

  setOptions({
    legend: {
      data: ['Venta', 'Variación'],
      textStyle: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: (params: any) => {
        const date = params[0].axisValue
        const dataIndex = dolares.findIndex(item => item.fecha === date)
        const currentDolar = dolares[dataIndex]
        const prevDolar = dolares[dataIndex - 1]

        const items = params
          .map((item: any) => {
            if (item.seriesName === 'Variación') {
              const variacion = parseFloat(item.value)
              const variacionColor = variacion > 0 ? colors.red[500] : colors.green[500]
              const variacionSigno = variacion > 0 ? '+' : ''
              return `
                <div>
                  <span>${item.seriesName}:</span>
                  <span class="font-bold" style="color: ${variacionColor}">
                    ${variacionSigno}$${variacion.toFixed(2)}
                  </span>
                </div>
              `
            }
            return `
              <div>
                <span>${item.seriesName}:</span>
                <span class="font-bold">$${item.value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            `
          })
          .join('')

        return `
          <div class="flex flex-col gap-1">
            <div class="font-semibold">${format(parseISO(date), 'dd/MM/yyyy')}</div>
            ${items}
            ${prevDolar ? `
              <div class="text-xs text-gray-500 mt-1">
                vs. día anterior: $${prevDolar.venta.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            ` : ''}
          </div>
        `
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
    xAxis: [
      {
        type: 'category',
        data: dolares.map(item => item.fecha),
        axisLabel: {
          color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
          formatter: (value: string) => {
            return format(parseISO(value), 'dd/MM/yyyy')
          },
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
          formatter: (value: number) => {
            return `$${value.toLocaleString('es-AR')}`
          },
        },
        min: Math.min(...dolares.map(item => item.venta)) - 10,
        max: Math.max(...dolares.map(item => item.venta)) + 10,
      },
      {
        type: 'value',
        axisLabel: {
          color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
          formatter: (value: number) => {
            return `$${value.toLocaleString('es-AR')}`
          },
        },
        min: Math.min(...dolares.map(item => item.variacion)) - 10,
        max: Math.max(...dolares.map(item => item.variacion)) + 10,
      },
    ],
    series: [
      {
        name: 'Venta',
        type: 'line',
        data: dolares.map(item => item.venta),
        itemStyle: {
          color: colors.neutral[theme.value === 'dark' ? 100 : 800],
        },
        yAxisIndex: 0,
      },
      {
        name: 'Variación',
        type: 'bar',
        data: dolares.map(item => ({
          value: item.variacion,
          itemStyle: {
            color:
              item.variacion > 0
                ? colors.indigo[theme.value === 'dark' ? 500 : 300]
                : colors.teal[theme.value === 'dark' ? 500 : 300],
          },
        })),
        yAxisIndex: 1,
      },
    ],
  } as any)
}

watch(
  [casa, theme],
  async ([value]) => {
    await setChartOptions(value)
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div>
    <div class="flex flex-row items-center space-x-2">
      <h3 style="margin: 0">
        Variación de los últimos 7 días
      </h3>

      <select v-model="casa" class="rounded p-2">
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.name }}
        </option>
      </select>
    </div>

    <div ref="chartRef" class="h-[50rem]" />
  </div>
</template>

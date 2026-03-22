<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { collect } from 'collect.js'
import colors from 'tailwindcss/colors'
import { format, parseISO } from 'date-fns'
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
    const data = await api.get('/eventos/presidenciales')

    return data
  }
  catch (error) {
    return []
  }
}

async function setChartOptions() {
  const seriesData = await fetchData()
  const seriesDataCollection = collect(seriesData)
    .reverse()
    .groupBy('fecha')
    .flatten(1)

  const valueMap = {
    elecciones: 0.5,
    asuncion: 1,
  }

  setOptions({
    legend: {
      data: seriesDataCollection
        .groupBy('tipo')
        .map((events, tipo) => tipo)
        .toArray(),
    },
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
      },
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
    ],
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
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const event = seriesDataCollection
          .where('tipo', params.seriesName)
          .where('fecha', params.value.timestamp)
          .first()

        let display
        switch (params.seriesName) {
          case 'elecciones':
            display = `Elecciones ${event.evento}`
            break
          case 'asuncion':
          default:
            display = event.evento
            break
        }

        return `<div class="flex flex-col gap-1">
          <div>${format(parseISO(params.value.timestamp), 'dd/MM/yyyy')}</div>
          <div>${display}</div>
        </div>`
      },
    },
    dataset: {
      source: seriesDataCollection.toArray().map((item) => {
        return {
          timestamp: format(parseISO(item.fecha), 'yyyy-MM-dd'),
          ...seriesDataCollection
            .groupBy('tipo')
            .map((events, tipo) => {
              const event = events.where('fecha', item.fecha).first()

              const value = valueMap[tipo]

              return {
                [tipo]: event ? value : null,
              }
            })
            .toArray()
            .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        }
      }),
      dimensions: [
        'timestamp',
        ...seriesDataCollection
          .groupBy('tipo')
          .map((events, tipo) => tipo)
          .toArray(),
      ],
    },
    xAxis: { type: 'time' },
    yAxis: {
      min: 0.3,
      max: 1.2,
      show: false,
    },
    series: [
      ...seriesDataCollection
        .groupBy('tipo')
        .map((events, tipo) => {
          let colorRange
          switch (tipo) {
            case 'elecciones':
              colorRange = colors.green
              break
            case 'asuncion':
              colorRange = colors.indigo
              break
            default:
              colorRange = colors.gray
              break
          }

          return {
            name: tipo,
            type: 'scatter',
            encode: {
              x: 'timestamp',
              y: tipo,
            },
            symbolSize: 10,
            itemStyle: {
              color: colorRange[theme.value === 'dark' ? 300 : 500],
            },
            label: {
              show: true,
              position: 'top',
              rotate: 45,
              formatter(params) {
                const event = events
                  .where('fecha', params.value.timestamp)
                  .first()

                return [`{e|${event.evento}}`].join('\n')
              },
              rich: {
                e: {
                  color: colorRange[theme.value === 'dark' ? 100 : 800],
                  backgroundColor:
                    colorRange[theme.value === 'dark' ? 800 : 100],
                  borderColor: colorRange[theme.value === 'dark' ? 700 : 300],
                  borderWidth: 1,
                  borderRadius: 2,
                  padding: [2, 4],
                },
              },
            },
          }
        })
        .toArray(),
    ],
  } as any)
}

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div>
    <h3>Eventos presidenciales</h3>

    <div ref="chartRef" class="h-[50rem]" />
  </div>
</template>

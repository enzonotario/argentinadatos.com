<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { collect } from 'collect.js'
import colors from 'tailwindcss/colors'
import { format, parseISO } from 'date-fns'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const colorsMap = {
  oficial: colors.gray,
  blue: colors.blue,
  bolsa: colors.purple,
  contadoconliqui: colors.pink,
  mayorista: colors.yellow,
  solidario: colors.teal,
  cripto: colors.red,
  tarjeta: colors.indigo,
}

const chartRef = ref()

const { setOptions, theme } = useEcharts(chartRef)

const api = useApi()

watch(theme, async () => {
  await setChartOptions()
})

async function fetchDolares() {
  try {
    const dolares = collect(await api.get('/cotizaciones/dolares'))
      .reverse()
      .groupBy('fecha')
      .flatten(1)
      .toArray()

    return dolares
  }
  catch (error) {
    return []
  }
}

async function fetchEventosPresidenciales() {
  try {
    return collect(await api.get('/eventos/presidenciales')).toArray()
  }
  catch (error) {
    return []
  }
}

async function setChartOptions() {
  const dolares = await fetchDolares()

  const eventosPresidenciales = await fetchEventosPresidenciales()

  const casas = collect(dolares).pluck('casa').unique().toArray()

  const fechas = collect(dolares).pluck('fecha').unique().sort().toArray()

  const series = collect(dolares)
    .groupBy('casa')
    .map((items, casa) => {
      const valoresCasa = items
        .sortBy('fecha')
        .mapWithKeys(item => [item.fecha, item.venta])

      return {
        name: casa,
        type: 'line',
        data: fechas.map((fecha, index) => {
          return valoresCasa.has(fecha) ? valoresCasa.get(fecha) : null
        }),
        itemStyle: {
          color: colorsMap.hasOwnProperty(casa)
            ? colorsMap[casa][theme.value === 'dark' ? 300 : 500]
            : colors.gray[theme.value === 'dark' ? 300 : 500],
        },

        ...(casa === 'oficial'
          ? {
              markLine: {
                symbol: 'none',
                data: eventosPresidenciales.map(eleccion => ({
                  xAxis: eleccion.fecha,
                  label: {
                    position:
                      eleccion.tipo === 'asuncion' ? 'end' : 'insideStartTop',
                    formatter:
                      eleccion.tipo === 'asuncion'
                        ? [`{a|${eleccion.evento}}`].join('\n')
                        : [
                            `{a|${eleccion.evento} - ${format(
                              parseISO(eleccion.fecha),
                              'yyyy',
                            )}}`,
                          ].join('\n'),

                    rich: {
                      a: {
                        color: theme.value === 'dark' ? 'white' : 'black',
                        backgroundColor:
                          theme.value === 'dark' ? 'black' : 'white',
                        borderColor: theme.value === 'dark' ? 'white' : 'black',
                        borderWidth: 1,
                        borderRadius: 2,
                        padding: [2, 4],
                      },
                    },
                  },
                })),
              },
            }
          : {}),
      }
    })
    .toArray()

  setOptions({
    legend: {
      data: casas,
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

        const items = params
          .map((item: any) => {
            const casa = item.seriesName
            const value = item.value

            return `<div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full" style="background-color: ${
                colorsMap.hasOwnProperty(casa)
                  ? colorsMap[casa][theme.value === 'dark' ? 300 : 500]
                  : colors.gray[theme.value === 'dark' ? 300 : 500]
              }"></div>
              <div>${casa}: $${value.toLocaleString('es-AR')}</div>
            </div>`
          })
          .join('')

        return `<div class="flex flex-col gap-1">
          <div>${format(parseISO(date), 'dd/MM/yyyy')}</div>
          ${items}
        </div>`
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
    xAxis: {
      type: 'category',
      data: fechas,
      // inverse: true,
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        formatter: (value: string) => {
          return format(parseISO(value), 'dd/MM/yyyy')
        },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        formatter: (value: number) => {
          return `$${value.toLocaleString('es-AR')}`
        },
      },
    },
    series,
  } as any)
}

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div>
    <h3>Cotización histórica del dólar</h3>

    <div ref="chartRef" class="h-[50rem]" />
  </div>
</template>

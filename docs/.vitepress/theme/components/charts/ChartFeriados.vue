<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import colors from 'tailwindcss/colors'
import { collect } from 'collect.js'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const props = defineProps({
  year: {
    type: Number,
    default: new Date().getFullYear(),
  },
})

const year = computed(() => props.year)

const chartRef = ref()

const { setOptions, theme } = useEcharts(chartRef)

const api = useApi()

const colorsMap = {
  inamovible: colors.orange[500],
  trasladable: colors.blue[500],
  puente: colors.green[500],
}

const loading = ref(false)

function capitalize(str: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function weekends(start: string, end: string) {
  const weekends = []
  let d = parseISO(start)
  const endDate = parseISO(end)

  while (d <= endDate) {
    if (d.getDay() === 0 || d.getDay() === 6) {
      weekends.push([format(d, 'yyyy-MM-dd'), 0])
    }
    d = new Date(d.getTime() + 86400000)
  }
  return weekends
}

function getDaysForRange(start: string, end: string) {
  const days: any[] = []
  let d = parseISO(start)
  const endDate = parseISO(end)
  while (d <= endDate) {
    days.push([format(d, 'yyyy-MM-dd'), 1])
    d = new Date(d.getTime() + 86400000)
  }
  return days
}

async function fetchFeriados() {
  loading.value = true

  try {
    const feriados = await api.get(`/feriados/${year.value}`)

    return feriados
  }
  catch (error) {
    return []
  }
  finally {
    loading.value = false
  }
}

function seriesForSemester(number: 1 | 2, feriados: any[]) {
  const types = ['inamovible', 'trasladable', 'puente']
  const isDark = theme.value === 'dark'
  const today = format(new Date(), 'yyyy-MM-dd')
  const start = `${year.value}-${number === 1 ? '01-01' : '07-01'}`
  const end = `${year.value}-${number === 1 ? '06-30' : '12-31'}`

  return [
    // Day labels (numbers)
    {
      type: 'scatter',
      coordinateSystem: 'calendar',
      calendarIndex: number - 1,
      symbolSize: 0,
      data: getDaysForRange(start, end).map((d: any) => {
        const dateStr = d[0]
        const isFeriado = feriados.some((f: any) => f.fecha === dateStr)
        const isToday = dateStr === today
        const isWeekend = parseISO(dateStr).getDay() === 0 || parseISO(dateStr).getDay() === 6

        let labelColor = isDark ? colors.gray[100] : colors.gray[900]
        if (isFeriado || isToday) {
          labelColor = '#fff'
        } else if (isWeekend) {
          labelColor = isDark ? colors.gray[100] : colors.gray[800]
        }

        return {
          value: d,
          label: {
            color: labelColor,
            fontWeight: (isFeriado || isToday) ? 'bold' : '500'
          }
        }
      }),
      label: {
        show: true,
        formatter: (params: any) => {
          return parseISO(params.value[0]).getDate().toString()
        },
        fontSize: 11,
        offset: [0, 0]
      },
      silent: true,
      z: 5
    },

    ...types.map(type => ({
      name: capitalize(type),
      type: 'scatter',
      coordinateSystem: 'calendar',
      calendarIndex: number - 1,
      symbolSize: 13,
      data: feriados
        .filter(item => item.tipo === type)
        .filter((item) => {
          const date = parseISO(item.fecha)
          return (
            date.getFullYear() === year.value
            && (number === 1 ? date.getMonth() < 6 : date.getMonth() >= 6)
          )
        })
        .map((item) => {
          return [item.fecha, 1]
        }),
      itemStyle: {
        color: colorsMap[type as keyof typeof colorsMap],
      },
      z: 3,
    })),

    {
      name: 'Fin de semana',
      type: 'scatter',
      coordinateSystem: 'calendar',
      calendarIndex: number - 1,
      symbolSize: 13,
      data: weekends(start, end),
      itemStyle: {
        color: isDark ? colors.gray[600] : colors.gray[200],
        opacity: 0.8
      },
      z: 2,
    },
  ]
}

async function setChartOptions() {
  const feriados = await fetchFeriados()
  const isDark = theme.value === 'dark'
  const today = format(new Date(), 'yyyy-MM-dd')

  await nextTick()
  if (!chartRef.value) return

  setOptions({
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? colors.gray[700] : colors.gray[200],
      textStyle: {
        color: isDark ? colors.gray[100] : colors.gray[900],
      },
      confine: true,
      formatter: (params: any) => {
        if (!params.value) return ''
        const dateStr = params.value[0]
        const d = feriados.find((item: any) => item.fecha === dateStr)
        const date = parseISO(dateStr)
        const dateTitle = capitalize(format(date, 'EEEE d MMMM yyyy', { locale: es }))

        if (d) {
          return `<div style="font-family: inherit;">
            <div style="font-size: 12px; color: ${isDark ? colors.gray[400] : colors.gray[500]};">${dateTitle}</div>
            <div style="font-size: 14px; font-weight: bold; margin-top: 4px;">${d.nombre}</div>
            <div style="font-size: 12px; margin-top: 4px;">Tipo: <span style="font-weight: bold; color: ${colorsMap[d.tipo as keyof typeof colorsMap]}">${capitalize(d.tipo)}</span></div>
          </div>`
        }

        const isToday = dateStr === today
        if (isToday) return `<div style="font-family: inherit;">
          <div style="font-size: 12px; color: ${isDark ? colors.gray[400] : colors.gray[500]};">${dateTitle}</div>
          <div style="font-size: 14px; font-weight: bold; margin-top: 4px;">Hoy</div>
        </div>`

        if (date.getDay() === 0 || date.getDay() === 6) {
           return `<div style="font-family: inherit;">
            <div style="font-size: 12px; color: ${isDark ? colors.gray[400] : colors.gray[500]};">${dateTitle}</div>
            <div style="font-size: 14px; font-weight: bold; margin-top: 4px;">Fin de semana</div>
          </div>`
        }
        return `<div style="font-family: inherit;">
          <div style="font-size: 12px; color: ${isDark ? colors.gray[400] : colors.gray[500]};">${dateTitle}</div>
        </div>`
      }
    },
    calendar: [
      {
        top: 60,
        left: 30,
        right: 30,
        range: [`${year.value}-01-01`, `${year.value}-06-30`],
        itemStyle: {
          borderWidth: 0.5,
          color: 'transparent',
          borderColor: isDark ? colors.gray[700] : colors.gray[200]
        },
        dayLabel: {
          firstDay: 0,
          nameMap: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
          color: isDark ? colors.gray[300] : colors.gray[700]
        },
        monthLabel: {
          nameMap: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
          color: isDark ? colors.gray[100] : colors.gray[900]
        },
      },
      {
        top: 240,
        left: 30,
        right: 30,
        range: [`${year.value}-07-01`, `${year.value}-12-31`],
        itemStyle: {
          borderWidth: 0.5,
          color: 'transparent',
          borderColor: isDark ? colors.gray[700] : colors.gray[200]
        },
        dayLabel: {
          firstDay: 0,
          nameMap: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
          color: isDark ? colors.gray[300] : colors.gray[700]
        },
        monthLabel: {
          nameMap: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
          color: isDark ? colors.gray[100] : colors.gray[900]
        },
      },
    ],
    legend: {
      top: 10,
      left: 'center',
      data: ['Inamovible', 'Trasladable', 'Puente', 'Fin de semana', 'Hoy'],
      textStyle: {
        color: isDark ? colors.gray[300] : colors.gray[700],
      },
    },
    series: [
      ...seriesForSemester(1, feriados),
      ...seriesForSemester(2, feriados),

      ...(new Date().getFullYear() === year.value
        ? [
            {
              name: 'Hoy',
              type: 'effectScatter',
              coordinateSystem: 'calendar',
              calendarIndex: new Date().getMonth() < 6 ? 0 : 1,
              data: [[today, 2]],
              showEffectOn: 'render',
              rippleEffect: {
                brushType: 'stroke',
              },
              symbolSize: 13,
              z: 4,
              itemStyle: {
                color: colors.indigo[500],
                shadowBlur: 10,
                shadowColor: colors.indigo[500],
              },
              label: {
                show: true,
                formatter: 'Hoy',
                color: isDark ? colors.gray[100] : colors.gray[700],
                position: 'top',
              },
            },
          ]
        : []),
    ],
  } as any)
}

watch(
  [year, theme],
  async () => {
    await setChartOptions()
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <div ref="chartRef" class="h-[26rem] w-full" />
  </div>
</template>

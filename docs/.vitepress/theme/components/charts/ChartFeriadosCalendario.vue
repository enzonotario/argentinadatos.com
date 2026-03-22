<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import colors from 'tailwindcss/colors'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const chartRef = ref()
const { setOptions, theme } = useEcharts(chartRef)
const api = useApi()

const props = defineProps({
  year: {
    type: Number,
    default: new Date().getFullYear(),
  },
})

const year = computed(() => props.year)
const loading = ref(false)

const colorsMap = {
  inamovible: colors.orange[500],
  trasladable: colors.blue[500],
  puente: colors.green[500],
}

function capitalize(str: string) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getWeekendsOfMonth(year: number, month: number) {
  const weekends: any[] = []
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0)
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (day === 0 || day === 6) {
      weekends.push([format(d, 'yyyy-MM-dd'), 0])
    }
  }
  return weekends
}

function getDaysOfMonth(year: number, month: number) {
  const days: any[] = []
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0)
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push([format(d, 'yyyy-MM-dd'), 1])
  }
  return days
}

async function fetchData() {
  loading.value = true
  try {
    const data = await api.get(`/feriados/${year.value}`)
    return data
  }
  catch (error) {
    return []
  }
  finally {
    loading.value = false
  }
}

async function setChartOptions() {
  const data = await fetchData()
  const isDark = theme.value === 'dark'
  const today = format(new Date(), 'yyyy-MM-dd')

  const calendars: any[] = []
  const series: any[] = []
  const titles: any[] = []

  const tipos = ['inamovible', 'trasladable', 'puente']
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  for (let month = 0; month < 12; month++) {
    const row = Math.floor(month / 3)
    const col = month % 3
    const range = `${year.value}-${(month + 1).toString().padStart(2, '0')}`

    const top = 80 + row * 220
    const left = 60 + col * 260
    const width = 200

    titles.push({
      text: meses[month],
      top: top - 50,
      left: left + width / 2,
      textAlign: 'center',
      textStyle: {
        color: isDark ? colors.gray[100] : colors.gray[900],
        fontSize: 14,
        fontWeight: 'bold'
      }
    })

    calendars.push({
      top: top,
      left: left,
      width: width,
      height: 150,
      cellSize: [25, 'auto'],
      range: range,
      orient: 'vertical',
      splitLine: { show: false },
      itemStyle: {
        borderWidth: 0.5,
        borderColor: isDark ? colors.gray[700] : colors.gray[200],
        color: 'transparent'
      },
      dayLabel: {
        firstDay: 0,
        nameMap: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
        color: isDark ? colors.gray[300] : colors.gray[700],
        fontSize: 10
      },
      monthLabel: { show: false },
      yearLabel: { show: false }
    })

    const monthData = data.filter((d: any) => d.fecha.startsWith(range))

    // Day labels (numbers)
    series.push({
      type: 'scatter',
      coordinateSystem: 'calendar',
      calendarIndex: month,
      symbolSize: 0,
      data: getDaysOfMonth(year.value, month).map((d: any) => {
        const dateStr = d[0]
        const isFeriado = data.some((f: any) => f.fecha === dateStr)
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
      z: 10
    })

    // Weekends (dots)
    series.push({
      name: 'Fin de semana',
      type: 'scatter',
      coordinateSystem: 'calendar',
      calendarIndex: month,
      symbolSize: 14,
      data: getWeekendsOfMonth(year.value, month),
      itemStyle: {
        color: isDark ? colors.gray[600] : colors.gray[200],
        opacity: 0.8
      },
      z: 2
    })

    // Holidays by type
    for (const tipo of tipos) {
      const typeData = monthData.filter((d: any) => d.tipo === tipo)
      series.push({
        name: capitalize(tipo),
        type: 'scatter',
        coordinateSystem: 'calendar',
        calendarIndex: month,
        symbolSize: 14,
        data: typeData.map((d: any) => [d.fecha, 1]),
        itemStyle: {
          color: colorsMap[tipo as keyof typeof colorsMap]
        },
        z: 3
      })
    }

    // Today
    if (today.startsWith(range)) {
      series.push({
        name: 'Hoy',
        type: 'effectScatter',
        coordinateSystem: 'calendar',
        calendarIndex: month,
        symbolSize: 14,
        data: [[today, 1]],
        itemStyle: {
          color: colors.indigo[500],
          shadowBlur: 10,
          shadowColor: colors.indigo[500]
        },
        z: 4
      })
    }
  }

  await nextTick()
  if (!chartRef.value) return

  setOptions({
    title: titles,
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
        const d = data.find((item: any) => item.fecha === dateStr)
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
    legend: {
      top: 10,
      left: 'center',
      data: ['Inamovible', 'Trasladable', 'Puente', 'Fin de semana', 'Hoy'],
      textStyle: {
        color: isDark ? colors.gray[300] : colors.gray[700]
      }
    },
    calendar: calendars,
    series: series
  })
}

watch([year, theme], async () => {
  await setChartOptions()
})

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div ref="chartRef" class="h-[1000px] w-full" />
  </div>
</template>

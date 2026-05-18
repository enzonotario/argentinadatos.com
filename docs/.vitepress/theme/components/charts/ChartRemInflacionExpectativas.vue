<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { addMonths, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const IPC_INDICADOR = 'Precios minoristas (IPC nivel general-Nacional; INDEC)'
const REPORTES_A_COMPARAR = 12
const COLORES_REM = [
  '#D4A017',
  '#D9A520',
  '#E0B12D',
  '#E4B83A',
  '#D9A520',
  '#C99314',
  '#B8870D',
  '#D6A419',
  '#E0B94A',
  '#C68A00',
  '#D8A33B',
  '#E2B94F',
]

interface InflacionReal {
  fecha: string
  valor: number
}

interface RemFila {
  informe: string
  fecha: string | null
  indicador: string
  muestra: string
  periodoTipo: string
  periodoDesde: string | null
  mediana: number | null
  promedio: number | null
}

interface RemProyeccion {
  informe: string
  fechaInforme: string | null
  puntos: Array<{
    monthKey: string
    valor: number
  }>
}

const api = useApi()
const chartRef = ref()
const { setOptions, theme } = useEcharts(chartRef)

const loading = ref(true)
const error = ref(false)
const inflacionReal = ref<InflacionReal[]>([])
const proyeccionesRem = ref<RemProyeccion[]>([])

function parseNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toMonthKey(value: string | null) {
  if (!value) return null
  return value.slice(0, 7)
}

function monthKeyToIso(monthKey: string) {
  return `${monthKey}-01`
}

function formatMonthKey(monthKey: string) {
  return format(parseISO(monthKeyToIso(monthKey)), 'MMM-yy', { locale: es })
    .replace('.', '')
    .toLowerCase()
}

function formatNumber(value: number) {
  return value.toLocaleString('es-AR', { maximumFractionDigits: 1 })
}

function monthKeyFromInforme(informe: string | null) {
  if (!informe) return null
  const match = informe.match(/^(\d{4})-(\d{2})$/)
  return match ? `${match[1]}-${match[2]}` : null
}

function generarMeses(startKey: string, endKey: string) {
  const output: string[] = []
  let current = parseISO(monthKeyToIso(startKey))
  const end = parseISO(monthKeyToIso(endKey))

  while (current <= end) {
    output.push(format(current, 'yyyy-MM'))
    current = addMonths(current, 1)
  }

  return output
}

function toRemFila(row: Record<string, unknown>): RemFila {
  return {
    informe: String(row.informe ?? ''),
    fecha: parseString(row.fecha),
    indicador: String(row.indicador ?? ''),
    muestra: String(row.muestra ?? ''),
    periodoTipo: String(row.periodoTipo ?? ''),
    periodoDesde: parseString(row.periodoDesde),
    mediana: parseNumber(row.mediana),
    promedio: parseNumber(row.promedio),
  }
}

function valorRem(row: RemFila) {
  return row.mediana ?? row.promedio
}

async function cargarDatos() {
  loading.value = true
  error.value = false

  try {
    const [inflacion, indiceRem] = await Promise.all([
      api.get('/finanzas/indices/inflacion'),
      api.get('/rems'),
    ])

    const paths = Array.isArray(indiceRem)
      ? indiceRem.filter(path => /^\/rems\/\d{4}\/\d{2}$/.test(path)).sort()
      : []

    const ultimosPaths = paths.slice(-REPORTES_A_COMPARAR)

    const reportesRaw = await Promise.all(
      ultimosPaths.map(path => api.get(path)),
    )

    inflacionReal.value = Array.isArray(inflacion)
      ? inflacion
          .map((row: any) => ({
            fecha: String(row.fecha ?? ''),
            valor: typeof row.valor === 'number' ? row.valor : Number.NaN,
          }))
          .filter(row => row.fecha && Number.isFinite(row.valor))
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
      : []

    proyeccionesRem.value = reportesRaw
      .map((rows): RemProyeccion | null => {
        if (!Array.isArray(rows) || rows.length === 0) return null

        const filas = rows.map(toRemFila)
        const informe = parseString(filas[0]?.informe) ?? ''
        const reportMonth = monthKeyFromInforme(informe)
        if (!reportMonth) return null

        const puntos = filas
          .filter(
            row =>
              row.indicador === IPC_INDICADOR &&
              row.muestra === 'todos' &&
              row.periodoTipo === 'mensual' &&
              row.periodoDesde &&
              toMonthKey(row.periodoDesde)! > reportMonth &&
              valorRem(row) != null,
          )
          .map(row => ({
            monthKey: toMonthKey(row.periodoDesde)!,
            valor: valorRem(row)!,
          }))
          .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

        if (puntos.length === 0) return null

        return {
          informe,
          fechaInforme: filas[0]?.fecha ?? null,
          puntos,
        }
      })
      .filter(Boolean) as RemProyeccion[]
  } catch {
    error.value = true
    inflacionReal.value = []
    proyeccionesRem.value = []
  } finally {
    loading.value = false
  }
}

const earliestReportMonth = computed(
  () =>
    proyeccionesRem.value
      .map(serie => monthKeyFromInforme(serie.informe))
      .filter(Boolean)
      .sort()[0] ?? null,
)

const latestMonth = computed(() => {
  const actual = inflacionReal.value
    .map(item => toMonthKey(item.fecha))
    .filter(Boolean)
  const rem = proyeccionesRem.value.flatMap(serie =>
    serie.puntos.map(p => p.monthKey),
  )
  return [...actual, ...rem].sort().at(-1) ?? null
})

const monthKeys = computed(() => {
  if (!earliestReportMonth.value || !latestMonth.value) return []
  return generarMeses(earliestReportMonth.value, latestMonth.value)
})

const actualPorMes = computed(() => {
  const map = new Map<string, number>()
  for (const item of inflacionReal.value) {
    const monthKey = toMonthKey(item.fecha)
    if (monthKey) map.set(monthKey, item.valor)
  }
  return map
})

const actualSeries = computed(() =>
  monthKeys.value.map(monthKey => actualPorMes.value.get(monthKey) ?? null),
)

function colorReal() {
  return theme.value === 'dark' ? colors.gray[100] : colors.slate[800]
}

async function setChartOptions() {
  if (loading.value || error.value) return

  if (monthKeys.value.length === 0) {
    setOptions({
      title: {
        text: 'Sin datos suficientes para comparar inflación y REM',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: theme.value === 'dark' ? colors.gray[300] : colors.gray[600],
          fontSize: 13,
        },
      },
    } as any)
    return
  }

  const categorias = monthKeys.value.map(formatMonthKey)
  const series = [
    ...proyeccionesRem.value.map((serie, index) => {
      const valoresPorMes = new Map(
        serie.puntos.map(p => [p.monthKey, p.valor]),
      )

      return {
        name: `REM ${serie.informe}`,
        type: 'line',
        data: monthKeys.value.map(
          monthKey => valoresPorMes.get(monthKey) ?? null,
        ),
        symbol: 'none',
        smooth: 0.2,
        connectNulls: false,
        lineStyle: {
          width: 2,
          color: COLORES_REM[index % COLORES_REM.length],
          opacity: 0.72,
        },
        itemStyle: {
          color: COLORES_REM[index % COLORES_REM.length],
        },
        emphasis: { focus: 'series' },
        z: 1,
      }
    }),
    {
      name: 'Inflación real',
      type: 'line',
      data: actualSeries.value,
      smooth: false,
      connectNulls: false,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: {
        width: 3,
        color: colorReal(),
      },
      itemStyle: {
        color: colorReal(),
      },
      label: {
        show: true,
        position: 'top',
        color: colorReal(),
        fontSize: 10,
        formatter: (params: any) =>
          typeof params.value === 'number' ? formatNumber(params.value) : '',
      },
      z: 5,
    },
  ]

  setOptions({
    grid: {
      left: 20,
      right: 20,
      top: 36,
      bottom: 58,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params: any[]) => {
        if (!params.length) return ''

        const lines = [
          `<div class="font-semibold">${params[0].axisValue}</div>`,
        ]

        const ordenados = [...params].sort((a, b) => {
          if (a.seriesName === 'Inflación real') return -1
          if (b.seriesName === 'Inflación real') return 1
          return a.seriesName.localeCompare(b.seriesName)
        })

        for (const item of ordenados) {
          if (item.value == null || item.value === '') continue
          lines.push(
            `<div>${item.marker}${item.seriesName}: <b>${formatNumber(Number(item.value))}%</b></div>`,
          )
        }

        return lines.join('')
      },
    },
    toolbox: {
      top: 0,
      right: 0,
      feature: {
        dataZoom: { yAxisIndex: 'none' },
        restore: {},
        saveAsImage: {},
      },
    },
    xAxis: {
      type: 'category',
      data: categorias,
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        rotate: 55,
        interval: 0,
        fontSize: 10,
      },
      axisLine: {
        lineStyle: {
          color: theme.value === 'dark' ? colors.gray[700] : colors.gray[300],
        },
      },
    },
    yAxis: {
      type: 'value',
      name: '% mensual',
      nameTextStyle: {
        color: theme.value === 'dark' ? colors.gray[200] : colors.gray[700],
      },
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        formatter: (value: number) => `${value.toLocaleString('es-AR')}%`,
      },
      splitLine: {
        lineStyle: {
          color: theme.value === 'dark' ? colors.gray[800] : colors.gray[200],
        },
      },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, height: 20 },
    ],
    series,
  } as any)
}

watch(theme, async () => {
  await nextTick()
  await setChartOptions()
})

onMounted(async () => {
  await cargarDatos()
  await nextTick()
  await setChartOptions()
})
</script>

<template>
  <div class="not-prose my-6 space-y-4">
    <div>
      <h3 class="text-lg font-semibold">
        Inflación mensual: expectativas versus realidad
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Línea oscura: inflación mensual observada. Líneas doradas: expectativas
        futuras de IPC mensual en cada REM del último año.
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Se usa la mediana del REM cuando está disponible; si no, el promedio.
      </p>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">
      Cargando comparación inflación vs REM...
    </div>

    <div
      v-else-if="error"
      class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      No se pudo cargar la comparación entre inflación real y expectativas REM.
    </div>

    <div v-else ref="chartRef" class="h-[38rem] w-full echarts-chart" />
  </div>
</template>

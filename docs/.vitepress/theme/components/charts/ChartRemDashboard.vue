<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useDark } from '@pureadmin/utils'
import { VueUiKpi } from 'vue-data-ui/vue-ui-kpi'
import { VueUiSparkline } from 'vue-data-ui/vue-ui-sparkline'
import { VueUiXy } from 'vue-data-ui/vue-ui-xy'
import { VueUiHorizontalBar } from 'vue-data-ui/vue-ui-horizontal-bar'
import { VueUiDumbbell } from 'vue-data-ui/vue-ui-dumbbell'
import { VueUiTable } from 'vue-data-ui/vue-ui-table'
import { VueUiTableSparkline } from 'vue-data-ui/vue-ui-table-sparkline'
import type {
  VueUiDumbbellConfig,
  VueUiDumbbellDataset,
  VueUiHorizontalBarConfig,
  VueUiHorizontalBarDatasetItem,
  VueUiKpiConfig,
  VueUiSparklineConfig,
  VueUiSparklineDatasetItem,
  VueUiTableConfig,
  VueUiTableDataset,
  VueUiTableSparklineConfig,
  VueUiTableSparklineDatasetItem,
  VueUiXyConfig,
  VueUiXyDatasetItem,
} from 'vue-data-ui'
import 'vue-data-ui/style.css'
import { useApi } from '../../composables/useApi'

const IPC = 'Precios minoristas (IPC nivel general-Nacional; INDEC)'
const IPC_NUCLEO = 'Precios minoristas (IPC núcleo-Nacional; INDEC)'
const TC = 'Tipo de cambio nominal'
const TAMAR = 'Tasa de interés (TAMAR)'
const PIB = 'PIB a precios constantes'
const DESOCUPACION = 'Desocupación abierta'
const EXPORTACIONES = 'Exportaciones'
const IMPORTACIONES = 'Importaciones'
const RESULTADO = 'Resultado Primario del SPNF'

const SHORT_NAME: Record<string, string> = {
  [IPC]: 'IPC',
  [IPC_NUCLEO]: 'IPC núcleo',
  [TC]: 'Tipo de cambio',
  [TAMAR]: 'TAMAR',
  [PIB]: 'PIB',
  [DESOCUPACION]: 'Desocupación',
  [EXPORTACIONES]: 'Exportaciones',
  [IMPORTACIONES]: 'Importaciones',
  [RESULTADO]: 'Resultado primario',
}

const KPI_ORDER = [IPC, TC, DESOCUPACION, TAMAR, PIB, RESULTADO]

const props = withDefaults(defineProps<{ fuente?: 'ultimo' | 'historico' }>(), {
  fuente: 'ultimo',
})

type RemFila = Record<string, unknown>

interface RemDato {
  informe: string
  fecha: string | null
  indicador: string
  muestra: string
  periodo: string
  periodoTipo: string
  periodoDesde: string | null
  periodoHasta: string | null
  unidad: string | null
  promedio: number | null
  mediana: number | null
  desvio: number | null
  maximo: number | null
  minimo: number | null
  percentil90: number | null
  percentil75: number | null
  percentil25: number | null
  percentil10: number | null
  participantes: number | null
}

const api = useApi()
const { isDark } = useDark()

const loading = ref(true)
const recargando = ref(false)
const error = ref(false)
const periodosDisponibles = ref<string[]>([])
const periodoSeleccionado = ref('')
const subtitulo = ref('')
const informe = ref('')
const fechaInforme = ref<string | null>(null)
const filas = ref<RemDato[]>([])

const theme = computed(() => (isDark.value ? 'dark' : ''))
const bg = computed(() => (isDark.value ? '#1b1b1f' : '#FFFFFF'))
const fg = computed(() => (isDark.value ? '#E5E7EB' : '#2D353C'))
const muted = computed(() => (isDark.value ? '#9CA3AF' : '#6B7280'))
const gridStroke = computed(() => (isDark.value ? '#3F3F46' : '#E5E7EB'))
const cardClass = computed(() =>
  isDark.value
    ? 'rounded-lg border border-zinc-700 bg-zinc-900/60 p-3'
    : 'rounded-lg border border-gray-200 bg-white p-3',
)

function periodoLabelDesdePath(path: string) {
  const m = path.match(/^\/rems\/(\d{4})\/(\d{2})$/)
  return m ? `${m[1]}-${m[2]}` : path
}

function parseNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function toRemDato(row: RemFila): RemDato {
  return {
    informe: String(row.informe ?? ''),
    fecha: parseString(row.fecha),
    indicador: String(row.indicador ?? ''),
    muestra: String(row.muestra ?? ''),
    periodo: String(row.periodo ?? ''),
    periodoTipo: String(row.periodoTipo ?? ''),
    periodoDesde: parseString(row.periodoDesde),
    periodoHasta: parseString(row.periodoHasta),
    unidad: parseString(row.unidad),
    promedio: parseNumber(row.promedio),
    mediana: parseNumber(row.mediana),
    desvio: parseNumber(row.desvio),
    maximo: parseNumber(row.maximo),
    minimo: parseNumber(row.minimo),
    percentil90: parseNumber(row.percentil90),
    percentil75: parseNumber(row.percentil75),
    percentil25: parseNumber(row.percentil25),
    percentil10: parseNumber(row.percentil10),
    participantes: parseNumber(row.participantes),
  }
}

function shortName(indicador: string) {
  return SHORT_NAME[indicador] ?? indicador
}

function formatValor(value: number | null, digits = 2) {
  if (value == null)
    return '—'
  return Number.isInteger(value)
    ? value.toLocaleString('es-AR')
    : value.toLocaleString('es-AR', { maximumFractionDigits: digits })
}

const filasTodos = computed(() => filas.value.filter(r => r.muestra === 'todos'))

function serie(indicador: string, periodoTipo: string) {
  return filasTodos.value
    .filter(r => r.indicador === indicador && r.periodoTipo === periodoTipo && r.promedio != null)
    .sort((a, b) => (a.periodoDesde || a.periodo).localeCompare(b.periodoDesde || b.periodo))
}

function ultima(indicador: string, preferTipos: string[] = ['anual', 'proximos_12_meses', 'mensual', 'trimestral']) {
  for (const tipo of preferTipos) {
    const rows = serie(indicador, tipo)
    if (rows.length)
      return rows.at(-1)!
  }
  return null
}

function sparkFrom(indicador: string, periodoTipo = 'mensual'): VueUiSparklineDatasetItem[] {
  return serie(indicador, periodoTipo).map(r => ({
    period: r.periodo,
    value: r.promedio,
  }))
}

interface KpiItem {
  key: string
  title: string
  value: number
  unidad: string
  periodo: string
  participantes: number | null
  spark: VueUiSparklineDatasetItem[]
  rounding: number
}

const kpis = computed<KpiItem[]>(() => {
  return KPI_ORDER.map((indicador) => {
    const row = ultima(indicador)
    if (!row || row.promedio == null)
      return null
    const spark = sparkFrom(indicador, 'mensual')
    return {
      key: indicador,
      title: shortName(indicador),
      value: row.promedio,
      unidad: row.unidad || '',
      periodo: `${row.periodo} · ${row.periodoTipo}`,
      participantes: row.participantes,
      spark: spark.length >= 2 ? spark : sparkFrom(indicador, 'trimestral'),
      rounding: Math.abs(row.promedio) >= 100 ? 0 : 2,
    }
  }).filter(Boolean) as KpiItem[]
})

function kpiConfig(item: KpiItem): VueUiKpiConfig {
  return {
    title: item.title,
    suffix: item.unidad ? ` ${item.unidad}` : '',
    valueRounding: item.rounding,
    backgroundColor: 'transparent',
    titleColor: muted.value,
    valueColor: fg.value,
    fontFamily: 'inherit',
    titleFontSize: 13,
    valueFontSize: 28,
    useAnimation: true,
  }
}

function sparkConfig(color = '#6366F1'): VueUiSparklineConfig {
  return {
    theme: theme.value,
    type: 'line',
    style: {
      backgroundColor: 'transparent',
      fontFamily: 'inherit',
      area: { show: true, useGradient: true, opacity: 25, color },
      line: { color, strokeWidth: 2, smooth: true },
      plot: { show: false },
      dataLabel: { show: false },
      title: { show: false },
    },
  }
}

const ipcMensualLabels = computed(() => serie(IPC, 'mensual').map(r => r.periodo))

const ipcXyDataset = computed<VueUiXyDatasetItem[]>(() => {
  const rows = serie(IPC, 'mensual')
  if (!rows.length)
    return []
  return [
    {
      name: 'Promedio',
      type: 'line',
      color: '#6366F1',
      useArea: true,
      smooth: true,
      series: rows.map(r => r.promedio),
    },
    {
      name: 'Mínimo',
      type: 'line',
      color: '#94A3B8',
      dashed: true,
      series: rows.map(r => r.minimo),
    },
    {
      name: 'Máximo',
      type: 'line',
      color: '#F59E0B',
      dashed: true,
      series: rows.map(r => r.maximo),
    },
  ]
})

const tcXyDataset = computed<VueUiXyDatasetItem[]>(() => {
  const rows = serie(TC, 'mensual')
  if (!rows.length)
    return []
  return [
    {
      name: 'Tipo de cambio',
      type: 'line',
      color: '#10B981',
      useArea: true,
      smooth: true,
      series: rows.map(r => r.promedio),
      suffix: ' $/USD',
    },
  ]
})

const tcLabels = computed(() => serie(TC, 'mensual').map(r => r.periodo))

const comercioXyDataset = computed<VueUiXyDatasetItem[]>(() => {
  const exp = serie(EXPORTACIONES, 'mensual')
  const imp = serie(IMPORTACIONES, 'mensual')
  if (!exp.length && !imp.length)
    return []
  const labels = [...new Set([...exp, ...imp].map(r => r.periodoDesde || r.periodo))].sort()
  const byPeriod = (rows: RemDato[]) => {
    const map = new Map(rows.map(r => [r.periodoDesde || r.periodo, r.promedio]))
    return labels.map(l => map.get(l) ?? null)
  }
  return [
    {
      name: 'Exportaciones',
      type: 'bar',
      color: '#3B82F6',
      series: byPeriod(exp),
    },
    {
      name: 'Importaciones',
      type: 'bar',
      color: '#F43F5E',
      series: byPeriod(imp),
    },
  ]
})

const comercioLabels = computed(() => {
  const exp = serie(EXPORTACIONES, 'mensual')
  const imp = serie(IMPORTACIONES, 'mensual')
  const keys = [...new Set([...exp, ...imp].map(r => r.periodoDesde || r.periodo))].sort()
  const labelMap = new Map(
    [...exp, ...imp].map(r => [r.periodoDesde || r.periodo, r.periodo]),
  )
  return keys.map(k => labelMap.get(k) || k)
})

function xyConfig(title: string, subtitle: string, labels: string[]): VueUiXyConfig {
  return {
    theme: theme.value,
    responsive: true,
    chart: {
      color: fg.value,
      backgroundColor: bg.value,
      zoom: {
        show: false,
        enableRangeHandles: false,
        enableSelectionDrag: false,
        preview: { enable: false },
      },
      title: {
        text: title,
        color: fg.value,
        subtitle: { text: subtitle, color: muted.value },
      },
      legend: { show: true, color: fg.value },
      grid: {
        stroke: gridStroke.value,
        labels: {
          color: muted.value,
          xAxisLabels: {
            values: labels,
            showOnlyFirstAndLast: labels.length > 8,
            rotation: 0,
          },
        },
      },
      tooltip: { show: true },
      userOptions: { show: false },
    },
  } as VueUiXyConfig
}

const ipcXyConfig = computed(() =>
  xyConfig('IPC mensual', 'Expectativa promedio, mínimo y máximo', ipcMensualLabels.value),
)
const tcXyConfig = computed(() =>
  xyConfig('Tipo de cambio nominal', 'Expectativa mensual ($/USD)', tcLabels.value),
)
const comercioXyConfig = computed(() =>
  xyConfig('Comercio exterior', 'Exportaciones vs importaciones (millones USD)', comercioLabels.value),
)

const anualesPctDataset = computed<VueUiHorizontalBarDatasetItem[]>(() => {
  const indicadores = [IPC, IPC_NUCLEO, PIB, DESOCUPACION, TAMAR]
  return indicadores
    .map((indicador) => {
      const row = serie(indicador, 'anual').at(-1) || serie(indicador, 'proximos_12_meses').at(-1)
      if (!row || row.promedio == null)
        return null
      return {
        name: `${shortName(indicador)} (${row.periodo})`,
        value: row.promedio,
      }
    })
    .filter(Boolean) as VueUiHorizontalBarDatasetItem[]
})

const anualesPctConfig = computed<VueUiHorizontalBarConfig>(() => ({
  theme: theme.value,
  responsive: true,
  style: {
    fontFamily: 'inherit',
    chart: {
      backgroundColor: bg.value,
      color: fg.value,
      title: {
        text: 'Expectativas anuales / 12 meses',
        color: fg.value,
        subtitle: {
          text: 'Variables en porcentaje',
          color: muted.value,
        },
      },
      legend: { show: false },
      layout: {
        bars: {
          dataLabels: {
            color: fg.value,
            value: {
              show: true,
              roundingValue: 1,
            },
            percentage: {
              show: false,
            },
          },
        },
      },
    },
  },
  userOptions: { show: false },
}))

interface DispersionStat {
  indicador: string
  label: string
  periodo: string
  unidad: string
  promedio: number
  mediana: number
  minimo: number
  maximo: number
  p25: number
  p75: number
}

function pctInRange(value: number, min: number, max: number) {
  if (max <= min)
    return 0
  return ((value - min) / (max - min)) * 100
}

const ipcDispersion = computed<DispersionStat | null>(() => {
  const row = serie(IPC, 'anual').find(r => r.periodo === '2026') || serie(IPC, 'anual').at(-1)
  if (!row || row.promedio == null || row.minimo == null || row.maximo == null)
    return null
  return {
    indicador: row.indicador,
    label: shortName(row.indicador),
    periodo: row.periodo,
    unidad: row.unidad || 'var. % i.a.',
    promedio: row.promedio,
    mediana: row.mediana ?? row.promedio,
    minimo: row.minimo,
    maximo: row.maximo,
    p25: row.percentil25 ?? row.minimo,
    p75: row.percentil75 ?? row.maximo,
  }
})

const dispersionDumbbellDataset = computed<VueUiDumbbellDataset[]>(() => {
  const indicadores = [IPC, IPC_NUCLEO, DESOCUPACION, TAMAR, PIB]
  return indicadores
    .map((indicador) => {
      const row = serie(indicador, 'anual').find(r => r.periodo === '2026')
        || serie(indicador, 'anual').at(-1)
        || serie(indicador, 'proximos_12_meses').at(-1)
      if (!row || row.minimo == null || row.maximo == null)
        return null
      return {
        name: `${shortName(indicador)} (${row.periodo})`,
        start: row.minimo,
        end: row.maximo,
      } satisfies VueUiDumbbellDataset
    })
    .filter(Boolean) as VueUiDumbbellDataset[]
})

const dispersionDumbbellConfig = computed<VueUiDumbbellConfig>(() => ({
  theme: theme.value,
  responsive: true,
  style: {
    fontFamily: 'inherit',
    chart: {
      backgroundColor: bg.value,
      color: fg.value,
      rowHeight: 42,
      padding: { top: 8, right: 48, bottom: 8, left: 140 },
      plots: {
        startColor: '#94A3B8',
        endColor: '#6366F1',
        evaluationColors: { enable: false },
        radius: 5,
        link: { strokeWidth: 3, type: 'line' },
      },
      labels: {
        formatter: ({ value }) => formatValor(value, 1),
        yAxisLabels: { showProgression: false, fontSize: 11 },
        startLabels: { show: true, rounding: 1 },
        endLabels: { show: true, rounding: 1 },
        axis: { xLabel: 'Mín → Máx del REM' },
      },
      legend: {
        show: true,
        labelStart: 'Mínimo',
        labelEnd: 'Máximo',
        position: 'top',
      },
      title: {
        text: 'Rango de expectativas',
        color: fg.value,
        subtitle: {
          text: 'Mínimo y máximo reportados por el REM (variables en %)',
          color: muted.value,
        },
      },
    },
  },
  userOptions: { show: false },
}))

const tableSparkDataset = computed<VueUiTableSparklineDatasetItem[]>(() => {
  const indicadores = [IPC, IPC_NUCLEO, TC, TAMAR, EXPORTACIONES, IMPORTACIONES]
  return indicadores
    .map((indicador) => {
      const rows = serie(indicador, 'mensual')
      if (rows.length < 2)
        return null
      return {
        name: shortName(indicador),
        values: rows.map(r => r.promedio),
        color: undefined,
      }
    })
    .filter(Boolean) as VueUiTableSparklineDatasetItem[]
})

const tableSparkColNames = computed(() => {
  const rows = serie(IPC, 'mensual')
  if (rows.length)
    return rows.map(r => r.periodo)
  return serie(TC, 'mensual').map(r => r.periodo)
})

const tableSparkConfig = computed<VueUiTableSparklineConfig>(() => ({
  theme: theme.value,
  showSparklines: true,
  showAverage: true,
  showMedian: true,
  showTotal: false,
  roundingAverage: 2,
  roundingMedian: 2,
  roundingValues: 2,
  colNames: tableSparkColNames.value,
  fontFamily: 'inherit',
  title: {
    text: 'Series mensuales',
    color: fg.value,
    subtitle: {
      text: 'Tendencias del informe actual',
      color: muted.value,
    },
  },
  thead: {
    backgroundColor: isDark.value ? '#27272A' : '#F9FAFB',
    color: fg.value,
  },
  tbody: {
    backgroundColor: bg.value,
    color: fg.value,
  },
  sparkline: {
    type: 'line',
    smooth: true,
    showArea: true,
    useGradient: true,
  },
  translations: {
    serie: 'Indicador',
    average: 'Prom.',
    median: 'Med.',
    chart: 'Tendencia',
  },
  userOptions: { show: false },
}))

const detailTableDataset = computed<VueUiTableDataset>(() => {
  const preferidos = [IPC, IPC_NUCLEO, TC, TAMAR, PIB, DESOCUPACION, EXPORTACIONES, IMPORTACIONES, RESULTADO]
  const rows = filasTodos.value.filter((r) => {
    if (!preferidos.includes(r.indicador))
      return false
    // Una fila representativa por indicador+tipo: la más cercana / última
    return true
  })

  // Deduplicate: keep last period per indicador+periodoTipo
  const best = new Map<string, RemDato>()
  for (const row of rows) {
    const key = `${row.indicador}||${row.periodoTipo}`
    const prev = best.get(key)
    if (!prev || (row.periodoDesde || '') > (prev.periodoDesde || ''))
      best.set(key, row)
  }

  const ordered = [...best.values()].sort((a, b) => {
    const ai = preferidos.indexOf(a.indicador)
    const bi = preferidos.indexOf(b.indicador)
    if (ai !== bi)
      return ai - bi
    return a.periodoTipo.localeCompare(b.periodoTipo)
  })

  return {
    header: [
      { name: 'Indicador', type: 'text', isSearch: true },
      { name: 'Tipo', type: 'text', isMultiselect: true },
      { name: 'Período', type: 'text' },
      { name: 'Promedio', type: 'numeric', decimals: 2, isSort: true },
      { name: 'Mediana', type: 'numeric', decimals: 2 },
      { name: 'Mín', type: 'numeric', decimals: 2 },
      { name: 'Máx', type: 'numeric', decimals: 2 },
      { name: 'Participantes', type: 'numeric', decimals: 0, isSort: true },
      { name: 'Unidad', type: 'text' },
    ],
    body: ordered.map(r => ({
      td: [
        shortName(r.indicador),
        r.periodoTipo,
        r.periodo,
        r.promedio ?? '',
        r.mediana ?? '',
        r.minimo ?? '',
        r.maximo ?? '',
        r.participantes ?? '',
        r.unidad ?? '',
      ],
    })),
  }
})

const detailTableConfig = computed<VueUiTableConfig>(() => ({
  fontFamily: 'inherit',
  maxHeight: 10000,
  rowsPerPage: Math.max(detailTableDataset.value.body.length, 1),
  style: {
    title: {
      text: 'Detalle del informe',
      color: fg.value,
      backgroundColor: bg.value,
      subtitle: {
        text: 'Último período por indicador y tipo',
        color: muted.value,
      },
    },
    th: {
      backgroundColor: isDark.value ? '#27272A' : '#F9FAFB',
      color: fg.value,
    },
    rows: {
      even: {
        backgroundColor: isDark.value ? '#18181B' : '#FFFFFF',
        color: fg.value,
      },
      odd: {
        backgroundColor: isDark.value ? '#27272A' : '#F9FAFB',
        color: fg.value,
      },
    },
  },
}))

const prox12 = computed(() =>
  filasTodos.value.filter(r => r.periodoTipo === 'proximos_12_meses' && r.promedio != null),
)

async function cargarIndiceHistorico() {
  const paths = (await api.get('/rems')) as string[]
  if (!Array.isArray(paths))
    throw new Error('Indice REM invalido')
  const periodos = paths.filter(p => /^\/rems\/\d{4}\/\d{2}$/.test(p))
  periodosDisponibles.value = periodos
  periodoSeleccionado.value = periodos[1] ?? periodos[0] ?? ''
  if (!periodoSeleccionado.value)
    throw new Error('Sin periodos en indice')
}

async function cargarDatosParaPath(path: string) {
  const data = (await api.get(path)) as RemFila[]
  if (!Array.isArray(data) || data.length === 0) {
    filas.value = []
    informe.value = ''
    fechaInforme.value = null
    return
  }
  const parsed = data.map(toRemDato)
  filas.value = parsed
  informe.value = parsed[0]?.informe ?? ''
  fechaInforme.value = parsed[0]?.fecha ?? null
}

async function cargar() {
  loading.value = true
  recargando.value = false
  error.value = false
  try {
    if (props.fuente === 'ultimo') {
      periodosDisponibles.value = []
      periodoSeleccionado.value = ''
      subtitulo.value = 'Último informe publicado'
      await cargarDatosParaPath('/rems/ultimo')
    }
    else {
      await cargarIndiceHistorico()
      subtitulo.value = ''
      await cargarDatosParaPath(periodoSeleccionado.value)
    }
  }
  catch {
    error.value = true
    filas.value = []
    informe.value = ''
    fechaInforme.value = null
    periodosDisponibles.value = []
    periodoSeleccionado.value = ''
  }
  finally {
    loading.value = false
  }
}

async function onSeleccionPeriodo() {
  if (props.fuente !== 'historico' || !periodoSeleccionado.value)
    return
  recargando.value = true
  error.value = false
  try {
    subtitulo.value = ''
    await cargarDatosParaPath(periodoSeleccionado.value)
    await nextTick()
  }
  catch {
    error.value = true
    filas.value = []
    informe.value = ''
    fechaInforme.value = null
  }
  finally {
    recargando.value = false
  }
}

watch(
  () => props.fuente,
  async () => {
    await cargar()
  },
)

onMounted(async () => {
  await cargar()
})
</script>

<template>
  <div class="not-prose my-6 space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 class="text-lg font-semibold">
          Dashboard REM
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          <span v-if="subtitulo">{{ subtitulo }} · </span>
          <span v-if="informe">
            Informe
            <code class="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">{{ informe }}</code>
          </span>
          <span v-if="fechaInforme"> · {{ fechaInforme }}</span>
        </p>
      </div>

      <div
        v-if="fuente === 'historico' && periodosDisponibles.length > 0 && !loading"
        class="flex flex-wrap items-center gap-2"
      >
        <label
          for="rem-dashboard-periodo"
          class="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Período
        </label>
        <select
          id="rem-dashboard-periodo"
          v-model="periodoSeleccionado"
          class="min-w-[10rem] rounded-md border bg-muted px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          @change="onSeleccionPeriodo"
        >
          <option
            v-for="p in periodosDisponibles"
            :key="p"
            :value="p"
          >
            {{ periodoLabelDesdePath(p) }}
          </option>
        </select>
        <span
          v-if="recargando"
          class="text-xs text-gray-500"
        >Actualizando...</span>
      </div>
    </div>

    <div
      v-if="loading"
      class="text-sm text-gray-500"
    >
      Cargando dashboard...
    </div>
    <div
      v-else-if="error"
      class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      No se pudieron cargar las expectativas.
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="item in kpis"
          :key="item.key"
          :class="cardClass"
        >
          <VueUiKpi
            :dataset="item.value"
            :config="kpiConfig(item)"
          >
            <template #comment-before>
              <div class="mb-1 text-xs text-gray-500 dark:text-gray-400">
                {{ item.periodo }}
                <span v-if="item.participantes != null">
                  · {{ item.participantes }} participantes
                </span>
              </div>
            </template>
            <template
              v-if="item.spark.length >= 2"
              #comment-after
            >
              <div class="mt-2 h-14 w-full">
                <VueUiSparkline
                  :dataset="item.spark"
                  :config="sparkConfig()"
                />
              </div>
            </template>
          </VueUiKpi>
        </div>
      </div>

      <!-- Expectativas a 12 meses -->
      <div
        v-if="prox12.length"
        :class="cardClass"
      >
        <h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Próximos 12 meses
        </h4>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="row in prox12"
            :key="row.indicador"
            class="rounded-md bg-gray-50 px-3 py-2 dark:bg-zinc-800/60"
          >
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ shortName(row.indicador) }}
            </div>
            <div class="text-lg font-semibold tabular-nums">
              {{ formatValor(row.promedio) }}
              <span class="text-xs font-normal text-gray-500">{{ row.unidad }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts principales -->
      <div class="grid gap-4 xl:grid-cols-2">
        <div
          v-if="ipcXyDataset.length"
          :class="cardClass"
          class="h-[22rem]"
        >
          <VueUiXy
            :dataset="ipcXyDataset"
            :config="ipcXyConfig"
          />
        </div>

        <div
          v-if="tcXyDataset.length"
          :class="cardClass"
          class="h-[22rem]"
        >
          <VueUiXy
            :dataset="tcXyDataset"
            :config="tcXyConfig"
          />
        </div>

        <div
          v-if="comercioXyDataset.length"
          :class="cardClass"
          class="h-[22rem]"
        >
          <VueUiXy
            :dataset="comercioXyDataset"
            :config="comercioXyConfig"
          />
        </div>

        <div
          v-if="anualesPctDataset.length"
          :class="cardClass"
          class="h-[22rem]"
        >
          <VueUiHorizontalBar
            :dataset="anualesPctDataset"
            :config="anualesPctConfig"
          />
        </div>
      </div>

      <!-- Dispersión IPC + rangos -->
      <div class="grid gap-4 xl:grid-cols-2">
        <div
          v-if="ipcDispersion"
          :class="cardClass"
        >
          <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {{ ipcDispersion.label }} {{ ipcDispersion.periodo }} · dispersión
          </h4>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Rango completo del REM (mín–máx). La banda verde es el consenso (p25–p75).
          </p>

          <div class="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            <div>
              <div class="text-[10px] uppercase tracking-wide text-gray-500">Mín</div>
              <div class="text-sm font-semibold tabular-nums">{{ formatValor(ipcDispersion.minimo, 1) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-gray-500">p25</div>
              <div class="text-sm font-semibold tabular-nums">{{ formatValor(ipcDispersion.p25, 1) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-gray-500">Mediana</div>
              <div class="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{{ formatValor(ipcDispersion.mediana, 1) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-gray-500">Promedio</div>
              <div class="text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{{ formatValor(ipcDispersion.promedio, 1) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-gray-500">p75</div>
              <div class="text-sm font-semibold tabular-nums">{{ formatValor(ipcDispersion.p75, 1) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-gray-500">Máx</div>
              <div class="text-sm font-semibold tabular-nums">{{ formatValor(ipcDispersion.maximo, 1) }}</div>
            </div>
          </div>

          <div class="rem-range mt-5">
            <div class="rem-range__track">
              <div
                class="rem-range__consensus"
                :style="{
                  left: `${pctInRange(ipcDispersion.p25, ipcDispersion.minimo, ipcDispersion.maximo)}%`,
                  width: `${pctInRange(ipcDispersion.p75, ipcDispersion.minimo, ipcDispersion.maximo) - pctInRange(ipcDispersion.p25, ipcDispersion.minimo, ipcDispersion.maximo)}%`,
                }"
              />
              <div
                class="rem-range__marker rem-range__marker--mediana"
                :style="{ left: `${pctInRange(ipcDispersion.mediana, ipcDispersion.minimo, ipcDispersion.maximo)}%` }"
                :title="`Mediana ${formatValor(ipcDispersion.mediana, 1)}`"
              />
              <div
                class="rem-range__marker rem-range__marker--promedio"
                :style="{ left: `${pctInRange(ipcDispersion.promedio, ipcDispersion.minimo, ipcDispersion.maximo)}%` }"
                :title="`Promedio ${formatValor(ipcDispersion.promedio, 1)}`"
              />
            </div>
            <div class="rem-range__labels">
              <span>{{ formatValor(ipcDispersion.minimo, 1) }}%</span>
              <span>{{ formatValor(ipcDispersion.maximo, 1) }}%</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-gray-400">
              <span class="inline-flex items-center gap-1">
                <span class="inline-block h-2 w-4 rounded-sm bg-emerald-300 dark:bg-emerald-500/70" />
                Consenso p25–p75
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="inline-block h-3 w-0.5 bg-emerald-600" />
                Mediana
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="inline-block h-3 w-0.5 bg-indigo-600" />
                Promedio
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="dispersionDumbbellDataset.length"
          :class="cardClass"
          class="min-h-[16rem]"
        >
          <VueUiDumbbell
            :dataset="dispersionDumbbellDataset"
            :config="dispersionDumbbellConfig"
          />
        </div>
      </div>

      <!-- Table sparkline -->
      <div
        v-if="tableSparkDataset.length"
        :class="cardClass"
      >
        <VueUiTableSparkline
          :dataset="tableSparkDataset"
          :config="tableSparkConfig"
        />
      </div>

      <!-- Detail table -->
      <div :class="[cardClass, 'rem-detail-table']">
        <VueUiTable
          :dataset="detailTableDataset"
          :config="detailTableConfig"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.rem-detail-table :deep(.vue-ui-table-paginator),
.rem-detail-table :deep(.vue-ui-table-pagination),
.rem-detail-table :deep(.vue-ui-table-navigation),
.rem-detail-table :deep(.vue-ui-table-navigation-indicator),
.rem-detail-table :deep(.vue-ui-table-size-warning) {
  display: none !important;
}

.rem-detail-table :deep(.vue-ui-table__wrapper) {
  max-height: none !important;
  overflow: visible !important;
}

.rem-range__track {
  position: relative;
  height: 1.25rem;
  border-radius: 9999px;
  background: color-mix(in srgb, #94a3b8 28%, transparent);
  overflow: visible;
}

.rem-range__consensus {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 9999px;
  background: color-mix(in srgb, #34d399 55%, transparent);
}

.rem-range__marker {
  position: absolute;
  top: -0.2rem;
  bottom: -0.2rem;
  width: 2px;
  transform: translateX(-50%);
  border-radius: 9999px;
}

.rem-range__marker--mediana {
  background: #059669;
}

.rem-range__marker--promedio {
  background: #4f46e5;
}

.rem-range__labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.35rem;
  font-size: 0.7rem;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
</style>

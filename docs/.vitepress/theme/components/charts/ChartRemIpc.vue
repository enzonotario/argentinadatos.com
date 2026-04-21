<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const IPC_INDICADOR = 'Precios minoristas (IPC nivel general-Nacional; INDEC)'

/** Orden de columnas alineado al esquema OpenAPI RemExpectativa */
const COLUMNAS_REM = [
  'informe',
  'fecha',
  'muestra',
  'indicador',
  'periodo',
  'periodoTipo',
  'periodoDesde',
  'periodoHasta',
  'referencia',
  'referenciaFecha',
  'unidad',
  'mediana',
  'promedio',
  'desvio',
  'maximo',
  'minimo',
  'percentil90',
  'percentil75',
  'percentil25',
  'percentil10',
  'participantes',
  'fuente',
  'publicacionUrl',
  'xlsxUrl',
] as const

const props = withDefaults(
  defineProps<{ fuente?: 'ultimo' | 'historico' }>(),
  { fuente: 'ultimo' },
)

const api = useApi()
const chartRef = ref()
const { setOptions, theme } = useEcharts(chartRef)

const loading = ref(true)
const recargando = ref(false)
const error = ref(false)
const informe = ref('')
const subtitulo = ref('')

const periodosDisponibles = ref<string[]>([])
const periodoSeleccionado = ref('')

type RemFila = Record<string, unknown>

interface RemRowIpc {
  periodo: string
  periodoDesde: string | null
  promedio: number | null
  participantes: number | null
}

const filasRemCompletas = ref<RemFila[]>([])
const filasIpcMensual = ref<RemRowIpc[]>([])

function periodoLabelDesdePath(path: string) {
  const m = path.match(/^\/rems\/(\d{4})\/(\d{2})$/)
  return m ? `${m[1]}-${m[2]}` : path
}

function ordenarIpcMensual(rows: RemRowIpc[]) {
  return [...rows].sort((a, b) => {
    if (!a.periodoDesde && !b.periodoDesde)
      return 0
    if (!a.periodoDesde)
      return 1
    if (!b.periodoDesde)
      return -1
    return a.periodoDesde.localeCompare(b.periodoDesde)
  })
}

function columnasDesdeFilas(filas: RemFila[]) {
  if (filas.length === 0)
    return [] as string[]
  const presentes = new Set<string>()
  for (const r of filas)
    Object.keys(r).forEach(k => presentes.add(k))
  const ordenadas = COLUMNAS_REM.filter(k => presentes.has(k))
  const extra = [...presentes].filter(k => !COLUMNAS_REM.includes(k as any)).sort()
  return [...ordenadas, ...extra]
}

function esUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https?:\/\//i.test(v)
}

function formatearCelda(val: unknown): string {
  if (val == null || val === '')
    return '—'
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? val.toLocaleString('es-AR')
      : val.toLocaleString('es-AR', { maximumFractionDigits: 4 })
  }
  if (typeof val === 'boolean')
    return val ? 'sí' : 'no'
  if (typeof val === 'string') {
    if (esUrl(val))
      return val
    return val
  }
  try {
    return JSON.stringify(val)
  }
  catch {
    return String(val)
  }
}

function filaTablaKey(row: RemFila, i: number) {
  const ind = String(row.indicador ?? '')
  const per = String(row.periodo ?? '')
  const mue = String(row.muestra ?? '')
  return `${i}-${ind}-${per}-${mue}`
}

async function cargarIndiceHistorico() {
  const paths: string[] = await api.get('/rems')
  if (!Array.isArray(paths))
    throw new Error('Índice REM inválido')

  const periodos = paths.filter(p => /^\/rems\/\d{4}\/\d{2}$/.test(p))
  periodosDisponibles.value = periodos
  periodoSeleccionado.value = periodos[1] ?? periodos[0] ?? ''
  if (!periodoSeleccionado.value)
    throw new Error('Sin períodos en el índice')
}

function extraerIpcMensual(data: RemFila[]) {
  return data
    .filter((r) => {
      return (
        r.indicador === IPC_INDICADOR
        && r.muestra === 'todos'
        && r.periodoTipo === 'mensual'
      )
    })
    .map((r): RemRowIpc => ({
      periodo: String(r.periodo ?? ''),
      periodoDesde: (r.periodoDesde as string | null) ?? null,
      promedio: typeof r.promedio === 'number' ? r.promedio : null,
      participantes: typeof r.participantes === 'number' ? r.participantes : null,
    }))
}

async function cargarDatosParaPath(path: string) {
  const data = await api.get(path) as RemFila[]
  if (!Array.isArray(data) || data.length === 0) {
    filasRemCompletas.value = []
    filasIpcMensual.value = []
    informe.value = ''
    return
  }
  filasRemCompletas.value = data
  informe.value = String(data[0]?.informe ?? '')
  filasIpcMensual.value = ordenarIpcMensual(extraerIpcMensual(data))
}

const columnasTabla = computed(() => columnasDesdeFilas(filasRemCompletas.value))

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
      subtitulo.value = `Informe ${periodoLabelDesdePath(periodoSeleccionado.value)}`
      await cargarDatosParaPath(periodoSeleccionado.value)
    }
  }
  catch {
    error.value = true
    filasRemCompletas.value = []
    filasIpcMensual.value = []
    informe.value = ''
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
    subtitulo.value = `Informe ${periodoLabelDesdePath(periodoSeleccionado.value)}`
    await cargarDatosParaPath(periodoSeleccionado.value)
    await nextTick()
    await setChartOptions()
  }
  catch {
    error.value = true
    filasRemCompletas.value = []
    filasIpcMensual.value = []
    informe.value = ''
  }
  finally {
    recargando.value = false
  }
}

const categorias = computed(() => filasIpcMensual.value.map(r => r.periodo))
const valores = computed(() =>
  filasIpcMensual.value.map(r => (r.promedio == null ? null : r.promedio)),
)

async function setChartOptions() {
  if (filasIpcMensual.value.length === 0) {
    setOptions({
      title: {
        text: 'Sin datos mensuales de IPC para este informe',
        left: 'center',
        textStyle: {
          color: theme.value === 'dark' ? colors.gray[300] : colors.gray[600],
        },
      },
    } as any)
    return
  }

  setOptions({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const i = params[0]?.dataIndex
        const row = filasIpcMensual.value[i]
        if (!row)
          return ''
        const prom = row.promedio != null
          ? row.promedio.toLocaleString('es-AR', { maximumFractionDigits: 2 })
          : '—'
        return (
          '<div class="flex flex-col gap-0.5 text-left">'
          + `<div class="font-semibold">${row.periodo}</div>`
          + `<div>Promedio: <b>${prom}</b> % m.a.</div>`
          + `<div class="text-xs opacity-80">Mensual · n=${row.participantes ?? '—'}</div>`
          + '</div>'
        )
      },
    },
    toolbox: {
      top: 8,
      right: 8,
      feature: {
        dataZoom: { yAxisIndex: 'none' },
        restore: {},
        saveAsImage: {},
      },
    },
    legend: {
      left: 'left',
      data: ['Promedio IPC (mensual)'],
      textStyle: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
      },
    },
    xAxis: {
      type: 'category',
      data: categorias.value,
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        rotate: 40,
        interval: 0,
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      name: '% m.a.',
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        formatter: (v: number) => v.toLocaleString('es-AR'),
      },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, height: 22 },
    ],
    series: [
      {
        name: 'Promedio IPC (mensual)',
        type: 'line',
        smooth: true,
        data: valores.value,
        itemStyle: { color: colors.indigo[500] },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 5,
      },
    ],
  } as any)
}

watch(theme, async () => {
  await setChartOptions()
})

onMounted(async () => {
  await cargar()
  await nextTick()
  await setChartOptions()
})

watch(() => props.fuente, async () => {
  await cargar()
  await nextTick()
  await setChartOptions()
})
</script>

<template>
  <div class="not-prose my-6 space-y-4">
    <div>
      <h3 class="text-lg font-semibold">
        IPC nivel general — promedio mensual
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ subtitulo }}<span v-if="informe"> · Informe <code class="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">{{ informe }}</code></span>
      </p>
    </div>
    <div
      v-if="fuente === 'historico' && periodosDisponibles.length > 0 && !loading"
      class="flex flex-wrap items-center gap-2"
    >
      <label for="rem-ipc-periodo" class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Período del informe
      </label>
      <select
        id="rem-ipc-periodo"
        v-model="periodoSeleccionado"
        class="min-w-[10rem] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
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
      >
        Actualizando…
      </span>
    </div>
    <div v-if="loading" class="text-sm text-gray-500">
      Cargando…
    </div>
    <div v-else-if="error" class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      No se pudieron cargar las expectativas.
    </div>
    <template v-else>
      <div class="relative">
        <div
          v-if="recargando"
          class="absolute inset-0 z-[1] flex items-center justify-center rounded-lg bg-white/70 dark:bg-gray-950/70"
        >
          <span class="text-sm text-gray-600 dark:text-gray-300">Actualizando gráfico…</span>
        </div>
        <div ref="chartRef" class="h-[28rem]" />
      </div>
      <div>
        <h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Tabla
        </h4>
        <div class="max-h-[min(32rem,70vh)] overflow-auto">
          <table class="min-w-max divide-y divide-gray-200 text-xs dark:divide-gray-700">
            <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900/95">
              <tr>
                <th
                  v-for="col in columnasTabla"
                  :key="col"
                  class="whitespace-nowrap px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-200"
                >
                  {{ col }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
              <tr
                v-for="(row, i) in filasRemCompletas"
                :key="filaTablaKey(row, i)"
                class="hover:bg-gray-50 dark:hover:bg-gray-900/40"
              >
                <td
                  v-for="col in columnasTabla"
                  :key="col"
                  class="max-w-[18rem] whitespace-pre-wrap break-words px-2 py-1 align-top text-gray-800 dark:text-gray-200"
                  :title="esUrl(row[col]) ? String(row[col]) : undefined"
                >
                  <a
                    v-if="esUrl(row[col])"
                    :href="String(row[col])"
                    class="text-indigo-600 underline decoration-indigo-400/60 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ String(row[col]).replace(/^https?:\/\/(www\.)?/, '').slice(0, 48) }}{{ String(row[col]).length > 52 ? '…' : '' }}</a>
                  <span v-else class="font-mono">{{ formatearCelda(row[col]) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

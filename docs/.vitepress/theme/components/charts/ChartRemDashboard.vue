<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useApi } from '../../composables/useApi'
import ChartRemVariableTrend from './ChartRemVariableTrend.vue'

const IPC_INDICADOR = 'Precios minoristas (IPC nivel general-Nacional; INDEC)'

const INTERES_PATTERNS = [
  /tipo de cambio/i,
  /pbi|producto interno bruto/i,
  /desocupaci[oó]n/i,
  /tasa de pol[ií]tica monetaria|tasa de inter[eé]s/i,
  /exportaciones/i,
  /importaciones/i,
  /saldo comercial/i,
  /super[aá]vit comercial/i,
  /consumo/i,
]

const PERIODO_TIPO_ORDEN: Record<string, number> = {
  mensual: 0,
  trimestral: 1,
  anual: 2,
}

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
  participantes: number | null
}

interface RemCard {
  key: string
  indicador: string
  valor: number | null
  unidad: string | null
  periodo: string
  periodoTipo: string
  participantes: number | null
  muestra: string
}

interface RemChartPoint {
  label: string
  value: number
  order: string
}

interface RemChartCard extends RemCard {
  puntos: RemChartPoint[]
}

const api = useApi()

const loading = ref(true)
const recargando = ref(false)
const error = ref(false)

const periodosDisponibles = ref<string[]>([])
const periodoSeleccionado = ref('')
const subtitulo = ref('')
const informe = ref('')
const fechaInforme = ref<string | null>(null)

const filas = ref<RemDato[]>([])

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
    participantes: parseNumber(row.participantes),
  }
}

function parseDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function valorPrincipal(row: RemDato) {
  if (row.promedio != null) return row.promedio
  if (row.mediana != null) return row.mediana
  return null
}

function formatValor(value: number | null) {
  if (value == null) return '—'
  return Number.isInteger(value)
    ? value.toLocaleString('es-AR')
    : value.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

const filasTodos = computed(() =>
  filas.value.filter(r => r.muestra === 'todos'),
)

function tipoRank(periodoTipo: string) {
  return PERIODO_TIPO_ORDEN[periodoTipo.toLowerCase()] ?? 99
}

function seleccionarTipoPreferido(tipos: string[]) {
  return [...tipos].sort((a, b) => tipoRank(a) - tipoRank(b))[0] ?? ''
}

const filasDashboard = computed(() => {
  const porIndicador = new Map<string, RemDato[]>()
  for (const row of filasTodos.value) {
    const key = row.indicador.trim()
    if (!key) continue
    if (!porIndicador.has(key)) porIndicador.set(key, [])
    porIndicador.get(key)!.push(row)
  }

  const candidatas: RemCard[] = []
  for (const [indicador, group] of porIndicador.entries()) {
    const tipos = [...new Set(group.map(r => r.periodoTipo).filter(Boolean))]
    const tipoPreferido = seleccionarTipoPreferido(tipos)
    if (!tipoPreferido) continue
    const rowsTipo = group.filter(r => r.periodoTipo === tipoPreferido)
    if (rowsTipo.length === 0) continue
    const ultima = [...rowsTipo]
      .sort((a, b) => {
        const da = a.periodoDesde ?? a.periodoHasta ?? a.periodo
        const db = b.periodoDesde ?? b.periodoHasta ?? b.periodo
        return da.localeCompare(db)
      })
      .at(-1)
    if (!ultima) continue
    candidatas.push({
      key: indicador,
      indicador,
      valor: valorPrincipal(ultima),
      unidad: ultima.unidad,
      periodo: ultima.periodo,
      periodoTipo: ultima.periodoTipo,
      participantes: ultima.participantes,
      muestra: ultima.muestra,
    })
  }

  const output: RemCard[] = []
  const pushUnique = (card: RemCard | undefined) => {
    if (!card) return
    if (output.some(c => c.key === card.key)) return
    output.push(card)
  }

  // IPC siempre primero cuando existe.
  pushUnique(candidatas.find(c => c.indicador === IPC_INDICADOR))

  for (const pattern of INTERES_PATTERNS) {
    pushUnique(candidatas.find(c => pattern.test(c.indicador)))
  }

  // Completa con otras variables para mantener una vista útil.
  for (const card of candidatas) {
    pushUnique(card)
    if (output.length >= 12) break
  }

  return [...output].sort((a, b) => {
    const aRank = tipoRank(a.periodoTipo)
    const bRank = tipoRank(b.periodoTipo)
    if (aRank !== bRank) return aRank - bRank
    return a.indicador.localeCompare(b.indicador)
  })
})

const seriesPorIndicadorTipo = computed(() => {
  const map = new Map<string, RemChartPoint[]>()
  for (const row of filasTodos.value) {
    const indicador = row.indicador.trim()
    const tipo = row.periodoTipo.trim().toLowerCase()
    if (!indicador || !tipo) continue
    const valor = valorPrincipal(row)
    if (valor == null) continue
    const key = `${indicador}||${tipo}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({
      label: row.periodo || row.periodoDesde || 's/d',
      value: valor,
      order: row.periodoDesde || row.periodoHasta || row.periodo || '',
    })
  }

  for (const [key, points] of map.entries()) {
    map.set(
      key,
      [...points].sort((a, b) => a.order.localeCompare(b.order)),
    )
  }
  return map
})

const cardsConSerie = computed<RemChartCard[]>(() => {
  return filasDashboard.value.map(card => {
    const key = `${card.indicador}||${card.periodoTipo.trim().toLowerCase()}`
    return {
      ...card,
      puntos: (seriesPorIndicadorTipo.value.get(key) ?? []).map(
        ({ label, value }) => ({ label, value }),
      ),
    }
  })
})

const columnasTabla = computed(
  () =>
    [
      'indicador',
      'periodoTipo',
      'periodo',
      'promedio',
      'mediana',
      'unidad',
      'participantes',
    ] as const,
)

const filasTabla = computed(() => {
  return cardsConSerie.value.map(card => {
    const original = filasTodos.value.find(r => r.indicador === card.indicador)
    return {
      indicador: card.indicador,
      periodoTipo: card.periodoTipo,
      periodo: card.periodo,
      promedio: original?.promedio ?? null,
      mediana: original?.mediana ?? null,
      unidad: card.unidad,
      participantes: card.participantes,
    }
  })
})

async function cargarIndiceHistorico() {
  const paths = (await api.get('/rems')) as string[]
  if (!Array.isArray(paths)) throw new Error('Indice REM invalido')
  const periodos = paths.filter(p => /^\/rems\/\d{4}\/\d{2}$/.test(p))
  periodosDisponibles.value = periodos
  periodoSeleccionado.value = periodos[1] ?? periodos[0] ?? ''
  if (!periodoSeleccionado.value) throw new Error('Sin periodos en indice')
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
      subtitulo.value = 'Ultimo informe publicado'
      await cargarDatosParaPath('/rems/ultimo')
    } else {
      await cargarIndiceHistorico()
      subtitulo.value = null
      await cargarDatosParaPath(periodoSeleccionado.value)
    }
  } catch {
    error.value = true
    filas.value = []
    informe.value = ''
    fechaInforme.value = null
    periodosDisponibles.value = []
    periodoSeleccionado.value = ''
  } finally {
    loading.value = false
  }
}

async function onSeleccionPeriodo() {
  if (props.fuente !== 'historico' || !periodoSeleccionado.value) return
  recargando.value = true
  error.value = false
  try {
    subtitulo.value = null
    await cargarDatosParaPath(periodoSeleccionado.value)
    await nextTick()
  } catch {
    error.value = true
    filas.value = []
    informe.value = ''
    fechaInforme.value = null
  } finally {
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
  <div class="not-prose my-6 space-y-4">
    <div>
      <h3 class="text-lg font-semibold">Informe REM</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ subtitulo }}
        <span v-if="subtitulo"> · </span>
        <span v-if="informe">
          Informe
          <code class="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">{{
            informe
          }}</code></span
        >
      </p>
    </div>

    <div
      v-if="
        fuente === 'historico' && periodosDisponibles.length > 0 && !loading
      "
      class="flex flex-wrap items-center gap-2"
    >
      <label
        for="rem-dashboard-periodo"
        class="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Periodo del informe
      </label>
      <select
        id="rem-dashboard-periodo"
        v-model="periodoSeleccionado"
        class="min-w-[10rem] rounded-md border bg-muted px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        @change="onSeleccionPeriodo"
      >
        <option v-for="p in periodosDisponibles" :key="p" :value="p">
          {{ periodoLabelDesdePath(p) }}
        </option>
      </select>
      <span v-if="recargando" class="text-xs text-gray-500">
        Actualizando...
      </span>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Cargando...</div>
    <div
      v-else-if="error"
      class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      No se pudieron cargar las expectativas.
    </div>
    <template v-else>
      <div class="grid gap-3 xl:grid-cols-2">
        <ChartRemVariableTrend
          v-for="card in cardsConSerie"
          :key="card.key"
          :indicador="card.indicador"
          :periodo-tipo="card.periodoTipo"
          :unidad="card.unidad"
          :participantes="card.participantes"
          :puntos="card.puntos"
        />
      </div>

      <div>
        <h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Variables seleccionadas
        </h4>
        <div class="max-h-[min(32rem,70vh)] overflow-auto">
          <table
            class="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-700"
          >
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
            <tbody
              class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950"
            >
              <tr
                v-for="row in filasTabla"
                :key="row.indicador"
                class="hover:bg-gray-50 dark:hover:bg-gray-900/40"
              >
                <td
                  class="max-w-[24rem] whitespace-pre-wrap break-words px-2 py-1 align-top text-gray-800 dark:text-gray-200"
                >
                  {{ row.indicador }}
                </td>
                <td
                  class="whitespace-nowrap px-2 py-1 font-mono text-gray-800 dark:text-gray-200"
                >
                  {{ row.periodoTipo || '—' }}
                </td>
                <td
                  class="whitespace-nowrap px-2 py-1 font-mono text-gray-800 dark:text-gray-200"
                >
                  {{ row.periodo || '—' }}
                </td>
                <td
                  class="whitespace-nowrap px-2 py-1 font-mono text-gray-800 dark:text-gray-200"
                >
                  {{ formatValor(row.promedio) }}
                </td>
                <td
                  class="whitespace-nowrap px-2 py-1 font-mono text-gray-800 dark:text-gray-200"
                >
                  {{ formatValor(row.mediana) }}
                </td>
                <td
                  class="max-w-[14rem] whitespace-pre-wrap break-words px-2 py-1 text-gray-800 dark:text-gray-200"
                >
                  {{ row.unidad || '—' }}
                </td>
                <td
                  class="whitespace-nowrap px-2 py-1 font-mono text-gray-800 dark:text-gray-200"
                >
                  {{ row.participantes ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDark } from '@pureadmin/utils'
import { VueUiTable } from 'vue-data-ui/vue-ui-table'
import type { VueUiTableConfig, VueUiTableDataset } from 'vue-data-ui'
import 'vue-data-ui/style.css'
import { useApi } from '../../composables/useApi'

interface TramoPlazoFijo {
  montoMinimo: number | null
  montoMaximo: number | null
  plazoMinDias: number | null
  plazoMaxDias: number | null
  tna: number
}

interface EntidadPlazoFijo {
  entidad: string
  tnaClientes?: number | null
  tasas?: TramoPlazoFijo[] | null
}

const PLAZOS_COLUMNAS = [30, 60, 90, 365]

const api = useApi()
const { isDark } = useDark()
const loading = ref(false)
const entidades = ref<EntidadPlazoFijo[]>([])

const bg = computed(() => (isDark.value ? '#1b1b1f' : '#FFFFFF'))
const fg = computed(() => (isDark.value ? '#E5E7EB' : '#2D353C'))
const muted = computed(() => (isDark.value ? '#9CA3AF' : '#6B7280'))

function formatearTna(tna: number) {
  return `${(tna * 100).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

function tramoCoincideConPlazo(tramo: TramoPlazoFijo, plazoDias: number) {
  const min = tramo.plazoMinDias ?? 0
  const max = tramo.plazoMaxDias ?? Number.POSITIVE_INFINITY
  return plazoDias >= min && plazoDias <= max
}

function prioridadTramo(tramo: TramoPlazoFijo, plazoDias: number) {
  const exacto =
    tramo.plazoMinDias === plazoDias && tramo.plazoMaxDias === plazoDias
  const sinMonto = tramo.montoMinimo == null && tramo.montoMaximo == null
  return (exacto ? 0 : 1) + (sinMonto ? 0 : 2)
}

function valorTnaNumericoParaPlazo(
  tasas: TramoPlazoFijo[],
  plazoDias: number,
  tnaFallback?: number | null,
) {
  const coincidentes = tasas
    .filter(tramo => tramoCoincideConPlazo(tramo, plazoDias))
    .sort((a, b) => prioridadTramo(a, plazoDias) - prioridadTramo(b, plazoDias))

  if (coincidentes.length === 0)
    return plazoDias === 30 && tnaFallback != null ? tnaFallback : null

  return Math.max(...coincidentes.map(tramo => tramo.tna))
}

function tnaParaPlazo(
  tasas: TramoPlazoFijo[],
  plazoDias: number,
  tnaFallback?: number | null,
) {
  const coincidentes = tasas
    .filter(tramo => tramoCoincideConPlazo(tramo, plazoDias))
    .sort((a, b) => prioridadTramo(a, plazoDias) - prioridadTramo(b, plazoDias))

  if (coincidentes.length === 0) {
    if (plazoDias === 30 && tnaFallback != null)
      return formatearTna(tnaFallback)
    return '—'
  }

  return [...new Set(coincidentes.map(tramo => formatearTna(tramo.tna)))].join(
    ' / ',
  )
}

const dataset = computed<VueUiTableDataset>(() => {
  const filas = entidades.value
    .filter(item => Array.isArray(item.tasas) && item.tasas.length > 0)
    .map(item => ({
      entidad: item.entidad,
      tna30: valorTnaNumericoParaPlazo(item.tasas!, 30, item.tnaClientes),
      celdas: PLAZOS_COLUMNAS.map(plazo =>
        tnaParaPlazo(item.tasas!, plazo, item.tnaClientes),
      ),
    }))
    .sort((a, b) => (b.tna30 ?? -1) - (a.tna30 ?? -1))

  return {
    header: [
      { name: 'Entidad', type: 'text', isSearch: true, isSort: true },
      ...PLAZOS_COLUMNAS.map(plazo => ({
        name: `${plazo} días`,
        type: 'text' as const,
      })),
    ],
    body: filas.map(fila => ({
      td: [fila.entidad, ...fila.celdas],
    })),
  }
})

const config = computed<VueUiTableConfig>(() => ({
  fontFamily: 'inherit',
  maxHeight: 1000,
  rowsPerPage: Math.max(dataset.value.body.length, 1),
  style: {
    title: {
      text: 'Tasas por plazo',
      color: fg.value,
      backgroundColor: bg.value,
      subtitle: {
        text: 'TNA según tramos publicados por cada entidad',
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

async function fetchData() {
  loading.value = true
  try {
    entidades.value = await api.get('/finanzas/tasas/plazoFijo')
  } catch {
    entidades.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="not-prose flex flex-col gap-4">
    <div v-if="loading" class="flex items-center gap-2 text-sm text-gray-500">
      <span
        class="h-5 w-5 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500"
      />
      Cargando tasas por plazo...
    </div>

    <p
      v-else-if="dataset.body.length === 0"
      class="m-0 text-sm text-gray-500 dark:text-gray-400"
    >
      No hay entidades con tasas desglosadas por plazo en este momento.
    </p>

    <div
      v-else
      class="plazo-tasas-table"
    >
      <VueUiTable :dataset="dataset" :config="config" />
    </div>
  </div>
</template>

<style scoped>
.plazo-tasas-table :deep(.vue-ui-table-paginator),
.plazo-tasas-table :deep(.vue-ui-table-pagination),
.plazo-tasas-table :deep(.vue-ui-table-navigation),
.plazo-tasas-table :deep(.vue-ui-table-navigation-indicator),
.plazo-tasas-table :deep(.vue-ui-table-size-warning),
.plazo-tasas-table :deep(.td-selector-info) {
  display: none !important;
}

.plazo-tasas-table :deep(.vue-ui-table__wrapper) {
  max-height: none !important;
  overflow: visible !important;
}
</style>

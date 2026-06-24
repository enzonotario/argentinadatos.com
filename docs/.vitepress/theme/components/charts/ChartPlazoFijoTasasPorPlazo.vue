<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
const loading = ref(false)
const entidades = ref<EntidadPlazoFijo[]>([])

function formatearTna(tna: number) {
  return `${(tna * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
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

  if (coincidentes.length === 0) {
    return plazoDias === 30 && tnaFallback != null ? tnaFallback : null
  }

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
    if (plazoDias === 30 && tnaFallback != null) {
      return formatearTna(tnaFallback)
    }

    return null
  }

  const valores = [...new Set(coincidentes.map(tramo => formatearTna(tramo.tna)))]

  return valores.join(' / ')
}

const filas = computed(() => {
  return entidades.value
    .filter(item => Array.isArray(item.tasas) && item.tasas.length > 0)
    .map(item => ({
      entidad: item.entidad,
      tasas: item.tasas!,
      tna30Dias: valorTnaNumericoParaPlazo(item.tasas!, 30, item.tnaClientes),
      celdas: PLAZOS_COLUMNAS.map(plazo =>
        tnaParaPlazo(item.tasas!, plazo, item.tnaClientes),
      ),
    }))
    .sort((a, b) => (b.tna30Dias ?? -1) - (a.tna30Dias ?? -1))
})

async function fetchData() {
  loading.value = true

  try {
    entidades.value = await api.get('/finanzas/tasas/plazoFijo')
  }
  catch {
    entidades.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-3">
      <h3 class="m-0 text-lg font-semibold">
        Tasas por plazo
      </h3>
      <span
        v-if="loading"
        class="h-5 w-5 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500"
      />
    </div>

    <p
      v-if="!loading && filas.length === 0"
      class="m-0 text-sm text-gray-500 dark:text-gray-400"
    >
      No hay entidades con tasas desglosadas por plazo en este momento.
    </p>

    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse rounded-lg bg-white shadow-sm dark:bg-gray-900">
        <thead>
          <tr class="bg-gray-50 dark:bg-gray-800">
            <th class="border-b border-gray-200 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Entidad
            </th>
            <th
              v-for="plazo in PLAZOS_COLUMNAS"
              :key="plazo"
              class="border-b border-gray-200 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              {{ plazo }} días
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="fila in filas"
            :key="fila.entidad"
            class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ fila.entidad }}
            </td>
            <td
              v-for="(valor, index) in fila.celdas"
              :key="`${fila.entidad}-${PLAZOS_COLUMNAS[index]}`"
              class="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100"
            >
              {{ valor ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDark } from '@pureadmin/utils'
import { VueUiHorizontalBar } from 'vue-data-ui/vue-ui-horizontal-bar'
import type {
  VueUiHorizontalBarConfig,
  VueUiHorizontalBarDatasetItem,
} from 'vue-data-ui'
import 'vue-data-ui/style.css'
import { useApi } from '../../composables/useApi'

type TipoTna = 'tnaClientes' | 'tnaNoClientes'

interface EntidadTna {
  entidad: string
  tnaClientes: number
  tnaNoClientes: number | null
}

const api = useApi()
const { isDark } = useDark()

const tipo = ref<TipoTna>('tnaClientes')
const loading = ref(false)
const entidades = ref<EntidadTna[]>([])

const theme = computed(() => (isDark.value ? 'dark' : ''))
const bg = computed(() => (isDark.value ? '#1b1b1f' : '#FFFFFF'))
const fg = computed(() => (isDark.value ? '#E5E7EB' : '#2D353C'))
const muted = computed(() => (isDark.value ? '#9CA3AF' : '#6B7280'))

const dataset = computed<VueUiHorizontalBarDatasetItem[]>(() => {
  return [...entidades.value]
    .filter((d) => {
      const value = d[tipo.value]
      return value != null && Number.isFinite(value) && value > 0
    })
    .sort((a, b) => (b[tipo.value] ?? 0) - (a[tipo.value] ?? 0))
    .map(d => ({
      name: d.entidad,
      value: d[tipo.value] as number,
    }))
})

const config = computed<VueUiHorizontalBarConfig>(() => ({
  theme: theme.value,
  responsive: true,
  loading: loading.value,
  style: {
    fontFamily: 'inherit',
    chart: {
      backgroundColor: bg.value,
      color: fg.value,
      title: {
        text: 'Tasas de Plazo Fijo',
        color: fg.value,
        subtitle: {
          text: tipo.value === 'tnaClientes'
            ? 'TNA clientes · referencia BCRA ($100.000 / 30 días)'
            : 'TNA no clientes · referencia BCRA ($100.000 / 30 días)',
          color: muted.value,
        },
      },
      legend: { show: false },
      layout: {
        bars: {
          sort: 'desc',
          dataLabels: {
            color: fg.value,
            value: {
              show: true,
              roundingValue: 2,
              suffix: '%',
            },
            percentage: { show: false },
          },
        },
      },
    },
  },
  userOptions: { show: false },
}))

const chartHeight = computed(() => {
  const rows = Math.max(dataset.value.length, 1)
  return 1000
})

async function fetchData() {
  loading.value = true
  try {
    const data = await api.get('/finanzas/tasas/plazoFijo')
    entidades.value = (Array.isArray(data) ? data : []).map((d: any) => ({
      entidad: String(d.entidad ?? ''),
      tnaClientes: Number((Number(d.tnaClientes) * 100).toFixed(2)),
      tnaNoClientes: d.tnaNoClientes
        ? Number((Number(d.tnaNoClientes) * 100).toFixed(2))
        : null,
    }))
  }
  catch {
    entidades.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchData()
})
</script>

<template>
  <div class="not-prose flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-4">
      <div class="flex items-center gap-2 text-sm">
        <label class="flex cursor-pointer items-center gap-1">
          <input
            v-model="tipo"
            type="radio"
            value="tnaClientes"
            class="cursor-pointer"
          >
          <span>Clientes</span>
        </label>
        <label class="flex cursor-pointer items-center gap-1">
          <input
            v-model="tipo"
            type="radio"
            value="tnaNoClientes"
            class="cursor-pointer"
          >
          <span>No Clientes</span>
        </label>
      </div>
      <span
        v-if="loading"
        class="h-5 w-5 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500"
      />
    </div>

    <div
      class="w-full overflow-auto"
      :style="{ height: 1000 }"
    >
      <VueUiHorizontalBar
        v-if="dataset.length || loading"
        :dataset="dataset"
        :config="config"
      />
      <p
        v-else
        class="p-4 text-sm text-gray-500"
      >
        No hay tasas disponibles para esta selección.
      </p>
    </div>
  </div>
</template>

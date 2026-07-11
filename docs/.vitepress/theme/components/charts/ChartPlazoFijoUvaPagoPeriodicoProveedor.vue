<script setup lang="ts">
import { computed } from 'vue'
import { useDark } from '@pureadmin/utils'
import { VueUiHorizontalBar } from 'vue-data-ui/vue-ui-horizontal-bar'
import type {
  VueUiHorizontalBarConfig,
  VueUiHorizontalBarDatasetItem,
} from 'vue-data-ui'
import 'vue-data-ui/style.css'

interface TasaPlazo {
  nombre: string
  plazoMinDias: number
  plazoMaxDias: number
  tna: number
  tea: number
}

export interface ProveedorPlazoFijoUva {
  id: string
  entidad: string
  logo?: string
  tasas: TasaPlazo[]
}

const props = defineProps<{
  proveedor: ProveedorPlazoFijoUva
}>()

const { isDark } = useDark()

const theme = computed(() => (isDark.value ? 'dark' : ''))
const bg = computed(() => (isDark.value ? '#1b1b1f' : '#FFFFFF'))
const fg = computed(() => (isDark.value ? '#E5E7EB' : '#2D353C'))
const muted = computed(() => (isDark.value ? '#9CA3AF' : '#6B7280'))

const titulo = computed(() => props.proveedor.entidad?.trim() || props.proveedor.id)

function etiquetaPlazo(t: TasaPlazo) {
  return `${t.plazoMinDias}–${t.plazoMaxDias} días`
}

const dataset = computed<VueUiHorizontalBarDatasetItem[]>(() => {
  return [...(props.proveedor.tasas || [])]
    .sort((a, b) => a.plazoMinDias - b.plazoMinDias)
    .map(t => ({
      name: etiquetaPlazo(t),
      value: Number((t.tna * 100).toFixed(2)),
      children: [
        {
          name: 'TNA',
          value: Number((t.tna * 100).toFixed(2)),
        },
        {
          name: 'TEA',
          value: Number((t.tea * 100).toFixed(2)),
        },
      ],
    }))
})

const config = computed<VueUiHorizontalBarConfig>(() => ({
  theme: theme.value,
  responsive: true,
  customPalette: ['#6366F1', '#8B5CF6'],
  style: {
    fontFamily: 'inherit',
    chart: {
      backgroundColor: bg.value,
      color: fg.value,
      title: {
        text: titulo.value,
        color: fg.value,
        subtitle: {
          text: 'TNA y TEA por tramo de plazo',
          color: muted.value,
        },
      },
      legend: {
        show: true,
        color: fg.value,
      },
      layout: {
        bars: {
          sort: 'none',
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
  const n = dataset.value.length
  return `${Math.min(80, Math.max(16, n * 3.2))}rem`
})
</script>

<template>
  <div
    class="w-full overflow-auto rounded-lg border border-gray-200 dark:border-zinc-700"
    :style="{ height: chartHeight }"
  >
    <VueUiHorizontalBar
      v-if="dataset.length"
      :dataset="dataset"
      :config="config"
    />
    <p
      v-else
      class="p-4 text-sm text-gray-500"
    >
      Sin tasas publicadas para {{ titulo }}.
    </p>
  </div>
</template>

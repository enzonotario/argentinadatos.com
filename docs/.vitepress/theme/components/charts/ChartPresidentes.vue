<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDark } from '@pureadmin/utils'
import { parseISO } from 'date-fns'
import {
  VueUiDumbbell,
  type VueUiDumbbellConfig,
  type VueUiDumbbellDataset,
  type VueUiDumbbellSvgSlotProps,
} from 'vue-data-ui/vue-ui-dumbbell'
import 'vue-data-ui/style.css'
import { useApi } from '../../composables/useApi'

type PresidenteDataset = VueUiDumbbellDataset & {
  imagen?: string
}

const AVATAR_SIZE = 36

const api = useApi()
const { isDark } = useDark()

const dataset = ref<PresidenteDataset[]>([])
const loading = ref(true)

function toYearValue(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return date.getFullYear() + dayOfYear / 365
}

function formatYear({ value }: { value: number }) {
  return String(Math.round(value))
}

function avatarY(svg: VueUiDumbbellSvgSlotProps['svg'], index: number) {
  return svg.top + index * svg.rowHeight + (svg.rowHeight - AVATAR_SIZE) / 2
}

const scale = computed(() => {
  if (!dataset.value.length) {
    return { min: 1800, max: 2030 }
  }

  const years = dataset.value.flatMap(d => [d.start, d.end]).filter((y): y is number => y != null)
  const min = Math.min(...years)
  const max = Math.max(...years)
  const pad = 5

  return {
    min: Math.floor((min - pad) / 10) * 10,
    max: Math.ceil((max + pad) / 10) * 10,
  }
})

const config = computed<VueUiDumbbellConfig>(() => ({
  loading: loading.value,
  responsive: false,
  theme: isDark.value ? 'dark' : '',
  useAnimation: true,
  style: {
    fontFamily: 'inherit',
    chart: {
      backgroundColor: isDark.value ? '#1b1b1f' : '#FFFFFF',
      color: isDark.value ? '#E5E7EB' : '#2D353C',
      width: 920,
      rowHeight: 48,
      padding: {
        top: 12,
        right: 56,
        bottom: 12,
        left: 220,
      },
      plots: {
        startColor: '#3B82F6',
        endColor: '#8B5CF6',
        evaluationColors: {
          enable: false,
        },
        radius: 4,
        link: {
          strokeWidth: 3,
          type: 'line',
        },
        gradient: {
          show: true,
          intensity: 40,
        },
      },
      grid: {
        scaleSteps: 10,
        scaleMin: scale.value.min,
        scaleMax: scale.value.max,
        horizontalGrid: {
          show: true,
          stroke: isDark.value ? '#3F3F46' : '#CCCCCC',
        },
        verticalGrid: {
          show: true,
          stroke: isDark.value ? '#3F3F46' : '#CCCCCC',
        },
      },
      labels: {
        formatter: formatYear,
        yAxisLabels: {
          show: true,
          showProgression: false,
          fontSize: 11,
          offsetX: -8,
        },
        axis: {
          yLabel: '',
          xLabel: 'Año',
        },
        startLabels: {
          show: true,
          rounding: 0,
        },
        endLabels: {
          show: true,
          rounding: 0,
        },
        xAxisLabels: {
          show: true,
          rounding: 0,
        },
      },
      legend: {
        show: true,
        labelStart: 'Inicio',
        labelEnd: 'Fin',
        position: 'top',
      },
      title: {
        text: 'Mandatos presidenciales',
        subtitle: {
          text: 'Inicio y fin de cada período',
        },
      },
    },
  },
  table: {
    columnNames: {
      series: 'Presidente',
      start: 'Inicio',
      end: 'Fin',
      progression: 'Variación',
    },
    td: {
      roundingValue: 0,
      roundingPercentage: 0,
    },
  },
  userOptions: {
    show: true,
    buttons: {
      pdf: false,
      csv: true,
      img: true,
      table: true,
      fullscreen: true,
      annotator: false,
    },
  },
}))

async function fetchData() {
  try {
    return await api.get('/presidentes')
  }
  catch {
    return []
  }
}

async function loadChart() {
  loading.value = true
  const presidentes = await fetchData()

  dataset.value = presidentes
    .map((p: any) => {
      if (!p.inicio)
        return null

      const start = toYearValue(parseISO(p.inicio))
      const end = p.fin
        ? toYearValue(parseISO(p.fin))
        : (p.nombre === 'Javier Milei' ? toYearValue(new Date()) : null)

      if (end === null)
        return null

      return {
        name: p.nombre,
        start,
        end,
        imagen: p.imagen || undefined,
      } satisfies PresidenteDataset
    })
    .filter(Boolean)
    .reverse() as PresidenteDataset[]

  loading.value = false
}

onMounted(async () => {
  await loadChart()
})
</script>

<template>
  <div class="chart-presidentes w-full overflow-auto">
    <VueUiDumbbell
      :dataset="dataset"
      :config="config"
    >
      <template #svg="{ svg }">
        <foreignObject
          v-for="(item, index) in dataset"
          :key="`${item.name}-${index}`"
          :x="8"
          :y="avatarY(svg, index)"
          :width="AVATAR_SIZE"
          :height="AVATAR_SIZE"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            class="presidente-avatar"
            :title="item.name"
          >
            <img
              v-if="item.imagen"
              :src="item.imagen"
              :alt="item.name"
              loading="lazy"
            >
            <span
              v-else
              class="presidente-avatar__fallback"
            >
              {{ item.name.slice(0, 1) }}
            </span>
          </div>
        </foreignObject>
      </template>
    </VueUiDumbbell>
  </div>
</template>

<style scoped>
.presidente-avatar {
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(148, 163, 184, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.presidente-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.presidente-avatar__fallback {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  line-height: 1;
}
</style>

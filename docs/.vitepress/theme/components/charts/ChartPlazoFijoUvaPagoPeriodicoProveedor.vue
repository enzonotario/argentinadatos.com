<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { useEcharts } from '../../composables/useEcharts'

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

const chartRef = ref()
const { setOptions, theme } = useEcharts(chartRef)

const titulo = computed(() => props.proveedor.entidad?.trim() || props.proveedor.id)

function etiquetaPlazo(t: TasaPlazo) {
  return `${t.plazoMinDias}–${t.plazoMaxDias} días`
}

const alturaGraficoRem = computed(() => {
  const n = props.proveedor.tasas?.length ?? 0
  return Math.min(80, Math.max(16, n * 2.6))
})

function seriesDesdeProveedor() {
  const filas = (props.proveedor.tasas || [])
    .map(t => ({
      label: etiquetaPlazo(t),
      plazoMinDias: t.plazoMinDias,
      tna: Number((t.tna * 100).toFixed(2)),
      tea: Number((t.tea * 100).toFixed(2)),
    }))
    .sort((a, b) => a.plazoMinDias - b.plazoMinDias)

  return {
    labels: filas.map(r => r.label),
    tna: filas.map(r => r.tna),
    tea: filas.map(r => r.tea),
  }
}

function aplicarOpcionesGrafico() {
  const { labels, tna, tea } = seriesDesdeProveedor()
  const isDark = theme.value === 'dark'
  const axisColor = isDark ? colors.gray[100] : colors.gray[800]

  setOptions({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!params?.length)
          return ''
        const lines = params.map(
          (item: any) => `${item.marker}${item.seriesName}: <b>${Number(item.value).toLocaleString('es-AR')}%</b>`,
        )
        return `${params[0].name}<br/>${lines.join('<br/>')}`
      },
    },
    legend: {
      left: 'left',
      data: ['TNA', 'TEA'],
      textStyle: { color: axisColor },
    },
    grid: {
      left: '3%',
      right: '12%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        color: axisColor,
        formatter: (value: number) => `${value.toLocaleString('es-AR')}%`,
      },
    },
    yAxis: {
      type: 'category',
      data: labels,
      inverse: true,
      axisLabel: { color: axisColor },
    },
    series: [
      {
        name: 'TNA',
        type: 'bar',
        data: tna,
        itemStyle: { color: colors.indigo[500] },
        label: {
          show: true,
          position: 'right',
          color: axisColor,
          formatter: (params: any) => `${params.value.toLocaleString('es-AR')}%`,
        },
      },
      {
        name: 'TEA',
        type: 'bar',
        data: tea,
        itemStyle: { color: colors.violet[500] },
        label: {
          show: true,
          position: 'right',
          color: axisColor,
          formatter: (params: any) => `${params.value.toLocaleString('es-AR')}%`,
        },
      },
    ],
  })
}

watch(theme, () => {
  aplicarOpcionesGrafico()
})

watch(() => props.proveedor, () => {
  aplicarOpcionesGrafico()
}, { deep: true })

onMounted(() => {
  aplicarOpcionesGrafico()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <h4 class="m-0 text-lg font-semibold">
      {{ titulo }}
    </h4>
    <div
      ref="chartRef"
      class="w-full"
      :style="{ height: `${alturaGraficoRem}rem` }"
    />
  </div>
</template>

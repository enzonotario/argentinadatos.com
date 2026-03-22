<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const chartRef = ref()
const { setOptions, theme } = useEcharts(chartRef)
const api = useApi()

const year = ref(new Date().getFullYear() === 2026 ? 2025 : new Date().getFullYear())
const loading = ref(false)
const years = Array.from({ length: new Date().getFullYear() - 1983 + 1 }, (_, i) => 1983 + i).reverse()

async function fetchData() {
  loading.value = true
  try {
    const data = await api.get(`/senado/actas/${year.value}`)
    if (!data) return []
    const results = Array.from(new Set(data.map((d: any) => d.resultado)))
      .map(resultado => ({
        resultado,
        cantidad: data.filter((d: any) => d.resultado === resultado).length
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
    return results
  }
  catch (error) {
    return []
  }
  finally {
    loading.value = false
  }
}

async function setChartOptions() {
  const data = await fetchData()
  const isDark = theme.value === 'dark'

  await nextTick()
  if (!chartRef.value) return

  setOptions({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const item = params[0]
        return `${item.name}<br/>Actas: <b>${item.value.toLocaleString('es-AR')}</b>`
      }
    },
    grid: {
      left: '3%',
      right: '10%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        color: isDark ? colors.gray[100] : colors.gray[800],
        formatter: (value: number) => value.toLocaleString('es-AR')
      }
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d.resultado),
      inverse: true,
      axisLabel: { color: isDark ? colors.gray[100] : colors.gray[800] }
    },
    series: [
      {
        name: 'Actas',
        type: 'bar',
        data: data.map(d => d.cantidad),
        itemStyle: { color: colors.indigo[500] },
        label: {
          show: true,
          position: 'right',
          color: isDark ? colors.gray[100] : colors.gray[800],
          formatter: (params: any) => params.value.toLocaleString('es-AR')
        }
      }
    ]
  })
}

watch([year, theme], async () => {
  await setChartOptions()
})

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <h3 class="m-0">Actas por resultado</h3>
      <select v-model="year" class="rounded p-2 bg-muted border border-gray-300 dark:border-gray-700">
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
      <span v-if="loading" class="animate-spin h-5 w-5 border-t-2 border-b-2 border-indigo-500 rounded-full"></span>
    </div>
    <div ref="chartRef" class="h-[30rem] echarts-chart" />
  </div>
</template>

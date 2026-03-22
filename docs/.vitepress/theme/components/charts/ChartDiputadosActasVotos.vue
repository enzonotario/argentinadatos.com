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

const years = Array.from({ length: new Date().getFullYear() - 1994 + 1 }, (_, i) => 1994 + i)
  .filter(y => ![1995, 1996, 1998, 1999, 2000, 2002, 2008, 2016, 2017, 2018, 2019].includes(y))
  .reverse()

async function fetchData() {
  loading.value = true
  try {
    const data = await api.get(`/diputados/actas/${year.value}`)
    if (!data) return []
    return data
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
        let res = `${params[0].name}`
        params.forEach((p: any) => {
          res += `<br/>${p.seriesName}: <b>${p.value.toLocaleString('es-AR')}</b>`
        })
        return res
      }
    },
    legend: {
      top: 10,
      data: ['Afirmativos', 'Negativos', 'Abstenciones'],
      textStyle: { color: isDark ? colors.gray[300] : colors.gray[700] }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map((d: any) => d.id),
      axisLabel: {
        rotate: 45,
        color: isDark ? colors.gray[100] : colors.gray[800]
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: isDark ? colors.gray[100] : colors.gray[800],
        formatter: (value: number) => value.toLocaleString('es-AR')
      }
    },
    series: [
      {
        name: 'Afirmativos',
        type: 'bar',
        stack: 'total',
        data: data.map((d: any) => d.votosAfirmativos),
        itemStyle: { color: isDark ? colors.teal[400] : colors.teal[600] }
      },
      {
        name: 'Negativos',
        type: 'bar',
        stack: 'total',
        data: data.map((d: any) => d.votosNegativos),
        itemStyle: { color: isDark ? colors.red[400] : colors.red[600] }
      },
      {
        name: 'Abstenciones',
        type: 'bar',
        stack: 'total',
        data: data.map((d: any) => d.abstenciones),
        itemStyle: { color: isDark ? colors.gray[400] : colors.gray[600] }
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
      <h3 class="m-0">Distribución de votos por acta (Diputados)</h3>
      <select v-model="year" class="rounded p-2 bg-muted border border-gray-300 dark:border-gray-700">
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
      <span v-if="loading" class="animate-spin h-5 w-5 border-t-2 border-b-2 border-indigo-500 rounded-full"></span>
    </div>
    <div ref="chartRef" class="h-[40rem] echarts-chart" />
  </div>
</template>

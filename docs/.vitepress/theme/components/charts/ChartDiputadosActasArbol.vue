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
    if (!data || data.length === 0) return { name: 'Sin datos', children: [] }
    
    // Build tree structure
    const tree: any = {
      name: 'Actas',
      children: []
    }
    
    const resultados = Array.from(new Set(data.map((d: any) => d.resultado)))
    for (const res of resultados) {
      const resNode = {
        name: res,
        children: data.filter((d: any) => d.resultado === res).map((d: any) => ({
          name: d.titulo || `Acta ${d.id}`,
          value: d.id
        }))
      }
      tree.children.push(resNode)
    }
    
    return tree
  }
  catch (error) {
    return { name: 'Error', children: [] }
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
      trigger: 'item',
      triggerOn: 'mousemove'
    },
    series: [
      {
        type: 'tree',
        data: [data],
        top: '1%',
        left: '15%',
        bottom: '1%',
        right: '25%',
        symbolSize: 7,
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 9,
          color: isDark ? colors.gray[100] : colors.gray[800]
        },
        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left'
          }
        },
        expandAndCollapse: true,
        animationDuration: 550,
        animationDurationUpdate: 750
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
      <h3 class="m-0">Árbol de actas (Diputados)</h3>
      <select v-model="year" class="rounded p-2 bg-muted border border-gray-300 dark:border-gray-700">
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
      <span v-if="loading" class="animate-spin h-5 w-5 border-t-2 border-b-2 border-indigo-500 rounded-full"></span>
    </div>
    <div ref="chartRef" class="h-[60rem] echarts-chart" />
  </div>
</template>

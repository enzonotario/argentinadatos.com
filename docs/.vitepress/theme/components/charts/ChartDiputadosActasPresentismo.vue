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
    return data.map((acta: any) => {
      const presentes = (acta.votosAfirmativos || 0) + (acta.votosNegativos || 0) + (acta.abstenciones || 0);
      const miembros = 257;
      return {
        id: acta.id,
        titulo: acta.titulo,
        presentismoPorcentaje: Number(((presentes / miembros) * 100).toFixed(2)),
      };
    });
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
      formatter: (params: any) => {
        const item = data[params.dataIndex]
        return `<b>${item.titulo}</b><br/>Presentismo: <b>${item.presentismoPorcentaje.toLocaleString('es-AR')}%</b>`
      }
    },
    visualMap: {
      min: 0,
      max: 100,
      dimension: 1,
      orient: 'vertical',
      right: 'right',
      top: 'center',
      text: ['100%', '0%'],
      calculable: true,
      inRange: {
        color: [colors.red[500], colors.blue[500]]
      },
      textStyle: { color: isDark ? colors.gray[100] : colors.gray[800] }
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.id),
      axisLabel: {
        rotate: 45,
        color: isDark ? colors.gray[100] : colors.gray[800]
      }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: (value: number) => `${value.toLocaleString('es-AR')}%`,
        color: isDark ? colors.gray[100] : colors.gray[800]
      }
    },
    series: [
      {
        name: 'Presentismo',
        type: 'scatter',
        symbolSize: 15,
        data: data.map(d => [d.id, d.presentismoPorcentaje]),
        itemStyle: {
          strokeColor: isDark ? colors.blue[300] : colors.blue[700],
          strokeWidth: 1
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
      <h3 class="m-0">Presentismo por acta (Diputados)</h3>
      <select v-model="year" class="rounded p-2 bg-muted border border-gray-300 dark:border-gray-700">
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
      <span v-if="loading" class="animate-spin h-5 w-5 border-t-2 border-b-2 border-indigo-500 rounded-full"></span>
    </div>
    <div ref="chartRef" class="h-[30rem] echarts-chart" />
  </div>
</template>

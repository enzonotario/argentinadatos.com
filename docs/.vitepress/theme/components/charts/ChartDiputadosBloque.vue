<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const chartRef = ref()
const { setOptions, theme } = useEcharts(chartRef)
const api = useApi()

watch(theme, async () => {
  await setChartOptions()
})

async function fetchData() {
  try {
    const data = await api.get('/diputados/diputados')
    const hoy = new Date().toISOString().split('T')[0]
    
    // 1. Filter for entries where mandate is active today
    const enMandato = data.filter((item: any) => {
      return item.periodoMandato.inicio <= hoy && item.periodoMandato.fin >= hoy;
    })
    
    // 2. Select the latest block entry for each deputy
    const porDiputado = enMandato.reduce((acc: any, curr: any) => {
      if (!acc[curr.id] || curr.periodoBloque.inicio > acc[curr.id].periodoBloque.inicio) {
        acc[curr.id] = curr
      }
      return acc
    }, {})
    
    const enFunciones = Object.values(porDiputado)
    
    const bloques = Array.from(new Set(enFunciones.map((d: any) => d.bloque)))
      .map(bloque => ({
        bloque,
        cantidad: enFunciones.filter((d: any) => d.bloque === bloque).length
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
      
    return bloques
  }
  catch (error) {
    return []
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
      backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? colors.gray[700] : colors.gray[200],
      textStyle: { color: isDark ? colors.gray[100] : colors.gray[900] },
      confine: true,
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const item = params[0]
        return `${item.name}<br/>Diputados: <b>${item.value.toLocaleString('es-AR')}</b>`
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
      data: data.map(d => d.bloque),
      inverse: true,
      axisLabel: {
        color: isDark ? colors.gray[100] : colors.gray[800],
      }
    },
    series: [
      {
        name: 'Diputados',
        type: 'bar',
        data: data.map(d => d.cantidad),
        itemStyle: {
          color: colors.indigo[500]
        },
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

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div class="w-full">
    <h3>Diputados en funciones por bloque</h3>
    <div ref="chartRef" class="h-[40rem] echarts-chart" />
  </div>
</template>

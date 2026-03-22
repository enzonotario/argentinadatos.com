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
    
    const enFunciones = Object.values(porDiputado) as any[]
    
    const bloques = Array.from(new Set(enFunciones.map((d: any) => d.bloque))).sort()
    const provincias = Array.from(new Set(enFunciones.map((d: any) => d.provincia))).sort()
    
    const heatmapData = []
    for (let i = 0; i < bloques.length; i++) {
      for (let j = 0; j < provincias.length; j++) {
        const cantidad = enFunciones.filter((d: any) => d.bloque === bloques[i] && d.provincia === provincias[j]).length
        if (cantidad > 0) {
          heatmapData.push([i, j, cantidad])
        }
      }
    }
      
    return { bloques, provincias, heatmapData }
  }
  catch (error) {
    return { bloques: [], provincias: [], heatmapData: [] }
  }
}

async function setChartOptions() {
  const { bloques, provincias, heatmapData } = await fetchData()

  const isDark = theme.value === 'dark'
  
  if (heatmapData.length === 0) return

  await nextTick()
  if (!chartRef.value) return

  const maxVal = Math.max(...heatmapData.map(d => d[2]), 1)

  setOptions({
    tooltip: {
      position: 'top',
      backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? colors.gray[700] : colors.gray[200],
      textStyle: { color: isDark ? colors.gray[100] : colors.gray[900] },
      confine: true,
      formatter: (params: any) => {
        return `${provincias[params.data[1]]}<br/>${bloques[params.data[0]]}: <b>${params.data[2].toLocaleString('es-AR')}</b>`
      }
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: {
        color: isDark 
          ? [colors.indigo[950], colors.indigo[400]] 
          : [colors.indigo[50], colors.indigo[800]]
      },
      textStyle: {
        color: isDark ? colors.gray[100] : colors.gray[800]
      }
    },
    grid: {
      left: 150,
      right: 50,
      bottom: 100,
      top: 150,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: bloques,
      position: 'top',
      axisLabel: {
        rotate: 45,
        fontSize: 10,
        color: isDark ? colors.gray[100] : colors.gray[800],
      }
    },
    yAxis: {
      type: 'category',
      data: provincias,
      inverse: true,
      axisLabel: {
        fontSize: 10,
        color: isDark ? colors.gray[100] : colors.gray[800],
      }
    },
    series: [
      {
        name: 'Diputados',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: true,
          fontSize: 9,
          fontWeight: 'bold',
          formatter: (params: any) => params.data[2].toLocaleString('es-AR'),
          color: (params: any) => {
            const val = params.data[2]
            const ratio = val / maxVal
            if (isDark) {
              // Dark mode: high values (ratio > 0.3) have light background (indigo 400), use dark text
              // Low values (ratio <= 0.3) have dark background (indigo 950), use light text
              return ratio > 0.3 ? colors.gray[900] : colors.gray[100]
            } else {
              // Light mode: high values (ratio > 0.3) have dark background (indigo 800), use light text
              // Low values (ratio <= 0.3) have light background (indigo 50), use dark text
              return ratio > 0.3 ? colors.white : colors.gray[900]
            }
          }
        },
        itemStyle: {
          borderColor: isDark ? colors.gray[700] : colors.gray[200],
          borderWidth: 1
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
  <div class="w-full overflow-hidden">
    <h3>Diputados en funciones por provincia y bloque</h3>
    <div ref="chartRef" class="h-[60rem] w-full echarts-chart" />
  </div>
</template>

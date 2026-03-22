<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
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
    const data = await api.get('/senado/senadores')
    const hoy = new Date()
    const enFunciones = data.filter((item: any) => {
      return new Date(item.periodoLegal.fin) >= hoy;
    })
    
    const provincias = Array.from(new Set(enFunciones.map((d: any) => d.provincia)))
      .map(provincia => ({
        provincia,
        cantidad: enFunciones.filter((d: any) => d.provincia === provincia).length
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
      
    return provincias
  }
  catch (error) {
    return []
  }
}

async function setChartOptions() {
  const data = await fetchData()

  setOptions({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const item = params[0]
        return `${item.name}<br/>Senadores: <b>${item.value.toLocaleString('es-AR')}</b>`
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
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
        formatter: (value: number) => value.toLocaleString('es-AR')
      }
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d.provincia),
      inverse: true,
      axisLabel: {
        color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
      }
    },
    series: [
      {
        name: 'Senadores',
        type: 'bar',
        data: data.map(d => d.cantidad),
        itemStyle: {
          color: colors.indigo[500]
        },
        label: {
          show: true,
          position: 'right',
          color: theme.value === 'dark' ? colors.gray[100] : colors.gray[800],
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
  <div>
    <h3>Senadores en funciones por provincia</h3>
    <div ref="chartRef" class="h-[40rem]" />
  </div>
</template>

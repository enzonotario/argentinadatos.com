<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const chartRef = ref()
const { setOptions, theme } = useEcharts(chartRef)
const api = useApi()

const tipo = ref('tnaClientes')
const loading = ref(false)

async function fetchData() {
  loading.value = true
  try {
    const data = await api.get('/finanzas/tasas/plazoFijo')
    return data.map((d: any) => ({
      entidad: d.entidad,
      tnaClientes: Number((d.tnaClientes * 100).toFixed(2)),
      tnaNoClientes: d.tnaNoClientes ? Number((d.tnaNoClientes * 100).toFixed(2)) : null,
    })).sort((a: any, b: any) => b[tipo.value] - a[tipo.value])
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

  setOptions({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const item = params[0]
        return `${item.name}<br/>TNA: <b>${item.value.toLocaleString('es-AR')}%</b>`
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
        formatter: (value: number) => {
          return `${value.toLocaleString('es-AR')}%`
        }
      }
    },
    yAxis: {
      type: 'category',
      data: data.map((d: any) => d.entidad),
      inverse: true,
      axisLabel: {
        color: isDark ? colors.gray[100] : colors.gray[800],
      }
    },
    series: [
      {
        name: 'TNA',
        type: 'bar',
        data: data.map((d: any) => d[tipo.value]),
        itemStyle: {
          color: colors.indigo[500]
        },
        label: {
          show: true,
          position: 'right',
          color: isDark ? colors.gray[100] : colors.gray[800],
          formatter: (params: any) => {
            return `${params.value.toLocaleString('es-AR')}%`
          }
        }
      }
    ]
  })
}

watch([tipo, theme], async () => {
  await setChartOptions()
})

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <h3 class="m-0">Tasas de Plazo Fijo</h3>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1 cursor-pointer">
          <input type="radio" v-model="tipo" value="tnaClientes" class="cursor-pointer" />
          <span>Clientes</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer">
          <input type="radio" v-model="tipo" value="tnaNoClientes" class="cursor-pointer" />
          <span>No Clientes</span>
        </label>
      </div>
      <span v-if="loading" class="animate-spin h-5 w-5 border-t-2 border-b-2 border-indigo-500 rounded-full"></span>
    </div>
    <div ref="chartRef" class="h-[60rem]" />
  </div>
</template>

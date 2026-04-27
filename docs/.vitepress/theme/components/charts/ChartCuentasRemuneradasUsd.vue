<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const chartRef = ref()
const { setOptions, theme } = useEcharts(chartRef)
const api = useApi()

const loading = ref(false)

async function fetchData() {
  loading.value = true
  try {
    const data = await api.get('/finanzas/cuentas-remuneradas-usd')
    return (data as { entidad: string; tasa: number; tope: number | null }[])
      .map(d => ({
        entidad: d.entidad,
        tasaPct: Number((d.tasa * 100).toFixed(2)),
        tope: d.tope,
      }))
      .sort((a, b) => b.tasaPct - a.tasaPct)
  }
  catch {
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
        const row = data.find((d: { entidad: string }) => d.entidad === item.name)
        const topeLine = row?.tope != null
          ? `<br/>Tope: <b>USD ${row.tope.toLocaleString('es-AR')}</b>`
          : '<br/>Tope: <b>sin tope informado</b>'
        return `${item.name}<br/>Tasa anual: <b>${item.value.toLocaleString('es-AR')}%</b>${topeLine}`
      },
    },
    grid: {
      left: '3%',
      right: '10%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        color: isDark ? colors.gray[100] : colors.gray[800],
        formatter: (value: number) => `${value.toLocaleString('es-AR')}%`,
      },
    },
    yAxis: {
      type: 'category',
      data: data.map((d: { entidad: string }) => d.entidad),
      inverse: true,
      axisLabel: {
        color: isDark ? colors.gray[100] : colors.gray[800],
      },
    },
    series: [
      {
        name: 'Tasa anual',
        type: 'bar',
        data: data.map((d: { tasaPct: number }) => d.tasaPct),
        itemStyle: {
          color: colors.emerald[500],
        },
        label: {
          show: true,
          position: 'right',
          color: isDark ? colors.gray[100] : colors.gray[800],
          formatter: (params: any) => `${params.value.toLocaleString('es-AR')}%`,
        },
      },
    ],
  })
}

watch(theme, async () => {
  await setChartOptions()
})

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-4">
      <h3 class="m-0">Cuentas remuneradas en USD</h3>
      <span v-if="loading" class="animate-spin h-5 w-5 border-t-2 border-b-2 border-emerald-500 rounded-full" />
    </div>
    <div ref="chartRef" class="h-[18rem]" />
  </div>
</template>

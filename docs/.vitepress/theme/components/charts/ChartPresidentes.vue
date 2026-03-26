<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { collect } from 'collect.js'
import colors from 'tailwindcss/colors'
import { format, parseISO } from 'date-fns'
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
    const data = await api.get('/presidentes')
    return data
  }
  catch (error) {
    return []
  }
}

async function setChartOptions() {
  const presidentes = await fetchData()
  
  const data = presidentes.map((p: any, index: number) => {
    const inicio = p.inicio ? parseISO(p.inicio).getTime() : null
    const fin = p.fin ? parseISO(p.fin).getTime() : (p.nombre === 'Javier Milei' ? new Date().getTime() : null)
    
    return {
      name: p.nombre,
      value: [
        index,
        inicio,
        fin,
        p.partido,
        p.vicepresidente
      ],
      itemStyle: {
        normal: {
          color: getPartidoColor(p.partido)
        }
      }
    }
  }).filter((item: any) => item.value[1] !== null && item.value[2] !== null)

  const categories = data.map((item: any) => item.name)

  setOptions({
    tooltip: {
      formatter: function (params: any) {
        const inicio = format(new Date(params.value[1]), 'dd/MM/yyyy')
        const fin = params.name === 'Javier Milei' && presidentes.find((p:any) => p.nombre === 'Javier Milei')?.fin === null 
          ? 'Actualidad' 
          : format(new Date(params.value[2]), 'dd/MM/yyyy')
          
        return `<b>${params.name}</b><br/>` +
               `Periodo: ${inicio} - ${fin}<br/>` +
               `Partido: ${params.value[3] || 'N/A'}<br/>` +
               `Vicepresidente: ${params.value[4] || 'N/A'}`
      }
    },
    grid: {
      height: '80%',
      top: '10%',
      bottom: '10%',
      left: '150',
      right: '20'
    },
    xAxis: {
      type: 'time',
      position: 'top',
      splitLine: {
        lineStyle: {
          type: 'dashed'
        }
      }
    },
    yAxis: {
      data: categories,
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        margin: 10
      }
    },
    series: [
      {
        type: 'custom',
        renderItem: function (params: any, api: any) {
          const categoryIndex = api.value(0)
          const start = api.coord([api.value(1), categoryIndex])
          const end = api.coord([api.value(2), categoryIndex])
          const height = api.size([0, 1])[1] * 0.6

          const rectShape = {
            x: start[0],
            y: start[1] - height / 2,
            width: end[0] - start[0],
            height: height
          }

          return {
            type: 'rect',
            transition: ['shape'],
            shape: rectShape,
            style: api.style()
          }
        },
        itemStyle: {
          opacity: 0.8
        },
        encode: {
          x: [1, 2],
          y: 0
        },
        data: data
      }
    ],
    dataZoom: [
      {
        type: 'slider',
        filterMode: 'weakFilter',
        showDataShadow: false,
        bottom: 10,
        start: 70,
        end: 100,
        labelFormatter: ''
      },
      {
        type: 'inside',
        filterMode: 'weakFilter'
      }
    ]
  })
}

function getPartidoColor(partido: string) {
  if (!partido) return colors.gray[500]
  const p = partido.toLowerCase()
  if (p.includes('justicialista') || p.includes('peronista') || p.includes('todos') || p.includes('victoria')) return colors.blue[500]
  if (p.includes('radical')) return colors.red[500]
  if (p.includes('republicana') || p.includes('cambiemos')) return colors.yellow[500]
  if (p.includes('libertad avanza')) return colors.purple[500]
  if (p.includes('federal')) return colors.red[700]
  if (p.includes('unitario')) return colors.blue[300]
  if (p.includes('autonomista nacional')) return colors.blue[800]
  if (p.includes('nacionalista')) return colors.blue[900]
  if (p.includes('independiente')) return colors.gray[400]
  return colors.gray[500]
}

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div ref="chartRef" style="width: 100%; height: 600px;" />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

const chartRef = ref()

const { setOptions, theme } = useEcharts(chartRef)

const api = useApi()

/**
 * Colores por mandato (identidad política reconocible, translúcidos para markArea).
 * De la Rúa=UCR rojo · Duhalde=PJ gris-azul ·
 * Néstor/Cristina/Alberto=celeste-azul FPV/FdT · Macri=amarillo PRO · Milei=violeta LLA
 */
const COLORES_MANDATO: Record<
  string,
  { light: string, dark: string, etiqueta: string }
> = {
  'de-la-rua': {
    light: 'rgba(185, 28, 28, 0.13)',
    dark: 'rgba(248, 113, 113, 0.18)',
    etiqueta: 'De la Rúa',
  },
  duhalde: {
    light: 'rgba(71, 85, 105, 0.12)',
    dark: 'rgba(148, 163, 184, 0.18)',
    etiqueta: 'Duhalde',
  },
  // Familia FPV / FdT — celeste/azul (variaciones suaves para distinguir mandatos)
  nestor: {
    light: 'rgba(2, 132, 199, 0.14)',
    dark: 'rgba(56, 189, 248, 0.20)',
    etiqueta: 'Néstor Kirchner',
  },
  'cristina-1': {
    light: 'rgba(3, 105, 161, 0.15)',
    dark: 'rgba(14, 165, 233, 0.22)',
    etiqueta: 'Cristina Fernández I',
  },
  'cristina-2': {
    light: 'rgba(7, 89, 133, 0.16)',
    dark: 'rgba(2, 132, 199, 0.24)',
    etiqueta: 'Cristina Fernández II',
  },
  macri: {
    light: 'rgba(202, 138, 4, 0.16)',
    dark: 'rgba(250, 204, 21, 0.22)',
    etiqueta: 'Macri',
  },
  alberto: {
    light: 'rgba(14, 165, 233, 0.13)',
    dark: 'rgba(125, 211, 252, 0.20)',
    etiqueta: 'Alberto F.',
  },
  milei: {
    light: 'rgba(126, 34, 206, 0.15)',
    dark: 'rgba(192, 132, 252, 0.22)',
    etiqueta: 'Milei',
  },
}

const COLOR_FALLBACK = {
  light: 'rgba(100, 116, 139, 0.10)',
  dark: 'rgba(148, 163, 184, 0.14)',
}

watch(theme, async () => {
  await setChartOptions()
})

async function fetchIcg() {
  try {
    return await api.get('/politica/indices/confianza-gobierno')
  }
  catch (error) {
    return []
  }
}

async function fetchAsuncionesPresidenciales() {
  try {
    const eventos = await api.get('/eventos/presidenciales')
    return eventos.filter((evento: any) => evento.tipo === 'asuncion')
  }
  catch (error) {
    return []
  }
}

async function fetchPresidentes() {
  try {
    return await api.get('/presidentes')
  }
  catch (error) {
    return []
  }
}

function mesCategoria(fecha: string) {
  return `${fecha.slice(0, 7)}-01`
}

function asuncionesEnSerie(asunciones: any[], fechasIcg: string[]) {
  const fechasSet = new Set(fechasIcg)

  return asunciones
    .map(asuncion => ({
      ...asuncion,
      fechaSerie: mesCategoria(asuncion.fecha),
    }))
    .filter(asuncion => fechasSet.has(asuncion.fechaSerie))
}

function normalizarNombre(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function idMandato(nombre: string, inicio: string) {
  const n = normalizarNombre(nombre)

  if (n.includes('rua'))
    return 'de-la-rua'
  if (n.includes('duhalde'))
    return 'duhalde'
  if (n.includes('nestor') && n.includes('kirchner'))
    return 'nestor'
  if (n.includes('cristina'))
    return inicio.startsWith('2007') ? 'cristina-1' : 'cristina-2'
  if (n.includes('macri'))
    return 'macri'
  if (n.includes('alberto') && n.includes('fernandez'))
    return 'alberto'
  if (n.includes('milei'))
    return 'milei'

  return null
}

function estiloMandato(id: string | null) {
  if (id && COLORES_MANDATO[id])
    return COLORES_MANDATO[id]
  return null
}

function periodosEnSerie(presidentes: any[], fechasIcg: string[]) {
  if (!fechasIcg.length)
    return []

  const primera = fechasIcg[0]
  const ultima = fechasIcg[fechasIcg.length - 1]

  const vistos = new Set<string>()
  const crudos = []

  for (const presidente of presidentes) {
    if (!presidente.inicio)
      continue

    const clave = `${presidente.nombre}|${presidente.inicio}`
    if (vistos.has(clave))
      continue
    vistos.add(clave)

    const fin = presidente.fin || ultima
    if (fin < primera || presidente.inicio > ultima)
      continue

    // Periodos de pocos días (p. ej. Rodríguez Saá) no aportan banda útil
    if (differenceInCalendarDays(parseISO(fin), parseISO(presidente.inicio)) < 20)
      continue

    crudos.push({
      nombre: presidente.nombre,
      inicio: presidente.inicio,
      fin,
      partido: presidente.partido,
      id: idMandato(presidente.nombre, presidente.inicio),
    })
  }

  crudos.sort((a, b) => a.inicio.localeCompare(b.inicio))

  // Fusionar solo tramos cortos consecutivos del mismo presidente
  // (p. ej. Néstor may–dic 2003 + mandato completo). No fusiona Cristina I/II.
  const fusionados = []
  for (const periodo of crudos) {
    const anterior = fusionados[fusionados.length - 1]
    if (
      anterior
      && anterior.nombre === periodo.nombre
      && differenceInCalendarDays(parseISO(anterior.fin), parseISO(anterior.inicio)) < 300
    ) {
      anterior.fin = periodo.fin
      continue
    }
    fusionados.push({ ...periodo })
  }

  return fusionados
    .map((periodo) => {
      const inicioMes = mesCategoria(
        periodo.inicio < primera ? primera : periodo.inicio,
      )
      const finMes = mesCategoria(periodo.fin > ultima ? ultima : periodo.fin)

      const inicioSerie
        = fechasIcg.find(fecha => fecha >= inicioMes) || fechasIcg[0]
      const finSerie
        = [...fechasIcg].reverse().find(fecha => fecha <= finMes) || ultima

      if (inicioSerie > finSerie)
        return null

      const estilo = estiloMandato(periodo.id)

      return {
        ...periodo,
        inicioSerie,
        finSerie,
        etiqueta: estilo?.etiqueta || periodo.nombre,
        colorLight: estilo?.light || COLOR_FALLBACK.light,
        colorDark: estilo?.dark || COLOR_FALLBACK.dark,
      }
    })
    .filter(Boolean)
}

function presidenteEnFecha(periodos: any[], fecha: string) {
  return periodos.find(
    periodo => fecha >= periodo.inicioSerie && fecha <= periodo.finSerie,
  )
}

async function setChartOptions() {
  const seriesData = await fetchIcg()
  const fechasIcg = seriesData.map((item: any) => item.fecha)
  const asunciones = asuncionesEnSerie(
    await fetchAsuncionesPresidenciales(),
    fechasIcg,
  )
  const periodos = periodosEnSerie(await fetchPresidentes(), fechasIcg)

  const labelColor = theme.value === 'dark' ? colors.gray[100] : colors.gray[800]
  const labelBg = theme.value === 'dark' ? colors.gray[900] : colors.white
  const bordeAsuncion
    = theme.value === 'dark' ? colors.amber[400] : colors.amber[600]

  setOptions({
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
      formatter: (params: any) => {
        const date = params[0].axisValue
        const dataIndex = seriesData.findIndex((item: any) => item.fecha === date)
        const currentItem = seriesData[dataIndex]
        const prevItem = seriesData[dataIndex - 1]

        if (!currentItem) {
          return ''
        }

        const currentValor = currentItem.valor
        const prevValor = prevItem?.valor || currentValor
        const variacion = currentItem.variacion ?? (currentValor - prevValor)
        const variacionPorcentaje = currentItem.variacion != null
          ? (currentItem.variacion * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : prevValor !== 0
            ? ((variacion / prevValor) * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '0,00'
        const isSubida = variacion > 0
        const variacionColor = isSubida ? colors.green[500] : colors.red[500]
        const variacionSigno = isSubida ? '+' : ''

        const asuncionDelMes = asunciones.find(
          asuncion => asuncion.fechaSerie === date,
        )
        const periodo = presidenteEnFecha(periodos, date)

        return `<div class="flex flex-col gap-1">
          <div class="font-semibold">${format(parseISO(date), 'MMMM yyyy', { locale: es })}</div>
          <div class="flex items-center gap-2">
            <span>ICG:</span>
            <span class="font-bold">${currentValor.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
          </div>
          ${prevItem ? `
            <div class="flex items-center gap-2">
              <span>Variación:</span>
              <span class="font-bold" style="color: ${variacionColor}">
                ${variacionSigno}${variacionPorcentaje}%
              </span>
            </div>
          ` : ''}
          ${periodo ? `
            <div class="text-xs mt-1">
              <span class="font-medium">${periodo.nombre}</span>
              ${periodo.partido ? `<span class="text-gray-500"> · ${periodo.partido}</span>` : ''}
            </div>
          ` : ''}
          ${asuncionDelMes ? `
            <div class="text-xs font-medium">
              ${asuncionDelMes.evento} (${format(parseISO(asuncionDelMes.fecha), 'dd/MM/yyyy')})
            </div>
          ` : ''}
        </div>`
      },
    },
    legend: {
      left: 'left',
      data: ['ICG'],
      textStyle: {
        color: labelColor,
      },
    },
    toolbox: {
      top: 20,
      right: 10,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
        },
        restore: {},
        saveAsImage: {},
      },
    },
    series: [
      {
        name: 'ICG',
        type: 'line',
        data: seriesData.map((item: any) => item.valor),
        itemStyle: {
          color: colors.sky[500],
        },
        lineStyle: {
          width: 2,
        },
        symbol: 'circle',
        symbolSize: 4,
        z: 3,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14, 165, 233, 0.18)' },
              { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
            ],
          },
        },
        markArea: {
          silent: true,
          data: periodos.map(periodo => [
            {
              name: periodo.etiqueta,
              xAxis: periodo.inicioSerie,
              itemStyle: {
                color: theme.value === 'dark' ? periodo.colorDark : periodo.colorLight,
              },
              label: {
                show: true,
                position: 'insideTop',
                distance: 4,
                formatter: periodo.etiqueta,
                color: labelColor,
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: labelBg,
                borderRadius: 2,
                padding: [2, 5],
              },
            },
            {
              xAxis: periodo.finSerie,
            },
          ]),
        },
        markLine: {
          symbol: 'none',
          silent: true,
          animation: false,
          lineStyle: {
            color: bordeAsuncion,
            type: 'dashed',
            width: 1.5,
          },
          label: {
            show: false,
          },
          data: asunciones.map(asuncion => ({
            xAxis: asuncion.fechaSerie,
          })),
        },
      },
    ],
    xAxis: {
      type: 'category',
      data: fechasIcg,
      axisLabel: {
        color: labelColor,
        formatter: (value: string) => {
          return format(parseISO(value), 'MM/yyyy')
        },
        rotate: 45,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: labelColor,
        formatter: (value: number) => {
          return value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        },
      },
    },
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        handleSize: '80%',
        handleStyle: {
          color: colors.sky[500],
        },
      },
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
    ],
  } as any)
}

onMounted(async () => {
  await setChartOptions()
})
</script>

<template>
  <div>
    <h3>Índice de Confianza en el Gobierno (ICG)</h3>

    <div ref="chartRef" class="h-[50rem]" />
  </div>
</template>

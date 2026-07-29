<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import colors from 'tailwindcss/colors'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useApi } from '../../composables/useApi'
import { useEcharts } from '../../composables/useEcharts'

type ModoChart = 'cronologico' | 'alineado'

const chartRef = ref()
const modo = ref<ModoChart>('cronologico')

const icgData = ref<any[]>([])
const asuncionesData = ref<any[]>([])
const periodosData = ref<any[]>([])
const cargando = ref(true)

const { setOptions, getInstance, theme } = useEcharts(chartRef)

const api = useApi()

/**
 * Colores por mandato (identidad política reconocible).
 * De la Rúa=UCR rojo · Duhalde=PJ gris-azul ·
 * Néstor/Cristina/Alberto=celeste-azul FPV/FdT · Macri=amarillo PRO · Milei=violeta LLA
 */
const COLORES_MANDATO: Record<
  string,
  { light: string, dark: string, line: string, etiqueta: string }
> = {
  'de-la-rua': {
    light: 'rgba(185, 28, 28, 0.13)',
    dark: 'rgba(248, 113, 113, 0.18)',
    line: '#b91c1c',
    etiqueta: 'De la Rúa',
  },
  duhalde: {
    light: 'rgba(71, 85, 105, 0.12)',
    dark: 'rgba(148, 163, 184, 0.18)',
    line: '#475569',
    etiqueta: 'Duhalde',
  },
  nestor: {
    light: 'rgba(2, 132, 199, 0.14)',
    dark: 'rgba(56, 189, 248, 0.20)',
    line: '#0284c7',
    etiqueta: 'Néstor Kirchner',
  },
  'cristina-1': {
    light: 'rgba(3, 105, 161, 0.15)',
    dark: 'rgba(14, 165, 233, 0.22)',
    line: '#0369a1',
    etiqueta: 'Cristina Fernández I',
  },
  'cristina-2': {
    light: 'rgba(7, 89, 133, 0.16)',
    dark: 'rgba(2, 132, 199, 0.24)',
    line: '#075985',
    etiqueta: 'Cristina Fernández II',
  },
  macri: {
    light: 'rgba(202, 138, 4, 0.16)',
    dark: 'rgba(250, 204, 21, 0.22)',
    line: '#ca8a04',
    etiqueta: 'Macri',
  },
  alberto: {
    light: 'rgba(14, 165, 233, 0.13)',
    dark: 'rgba(125, 211, 252, 0.20)',
    line: '#0ea5e9',
    etiqueta: 'Alberto F.',
  },
  milei: {
    light: 'rgba(126, 34, 206, 0.15)',
    dark: 'rgba(192, 132, 252, 0.22)',
    line: '#7e22ce',
    etiqueta: 'Milei',
  },
}

const COLOR_FALLBACK = {
  light: 'rgba(100, 116, 139, 0.10)',
  dark: 'rgba(148, 163, 184, 0.14)',
  line: '#64748b',
}

watch([theme, modo], async () => {
  if (!icgData.value.length)
    return
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
        colorLine: estilo?.line || COLOR_FALLBACK.line,
      }
    })
    .filter(Boolean)
}

function presidenteEnFecha(periodos: any[], fecha: string) {
  return periodos.find(
    periodo => fecha >= periodo.inicioSerie && fecha <= periodo.finSerie,
  )
}

function seriesAlineadasPorMandato(seriesData: any[], periodos: any[]) {
  const porPeriodo = periodos.map((periodo) => {
    const puntos = seriesData
      .filter(
        item => item.fecha >= periodo.inicioSerie && item.fecha <= periodo.finSerie,
      )
      .map((item, mes) => ({
        mes,
        fecha: item.fecha,
        valor: item.valor,
        variacion: item.variacion,
      }))

    return { periodo, puntos }
  }).filter(item => item.puntos.length >= 3)

  const maxMeses = Math.max(0, ...porPeriodo.map(item => item.puntos.length))
  const categorias = Array.from({ length: maxMeses }, (_, i) => i)

  return {
    categorias,
    series: porPeriodo.map(({ periodo, puntos }) => ({
      name: periodo.etiqueta,
      type: 'line' as const,
      connectNulls: false,
      data: categorias.map((mes) => {
        const punto = puntos.find(p => p.mes === mes)
        return punto ? punto.valor : null
      }),
      itemStyle: { color: periodo.colorLine },
      lineStyle: { width: 2, color: periodo.colorLine },
      symbol: 'circle',
      symbolSize: 4,
      puntos,
      periodo,
    })),
  }
}

function opcionesCronologico(
  seriesData: any[],
  asunciones: any[],
  periodos: any[],
  labelColor: string,
  labelBg: string,
  bordeAsuncion: string,
) {
  const fechasIcg = seriesData.map(item => item.fecha)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        const date = params[0].axisValue
        const dataIndex = seriesData.findIndex(item => item.fecha === date)
        const currentItem = seriesData[dataIndex]
        const prevItem = seriesData[dataIndex - 1]

        if (!currentItem)
          return ''

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
        const asuncionDelMes = asunciones.find(a => a.fechaSerie === date)
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
      textStyle: { color: labelColor },
    },
    toolbox: {
      top: 20,
      right: 10,
      feature: {
        dataZoom: { yAxisIndex: 'none' },
        restore: {},
        saveAsImage: {},
      },
    },
    series: [
      {
        name: 'ICG',
        type: 'line',
        data: seriesData.map(item => item.valor),
        itemStyle: { color: colors.sky[500] },
        lineStyle: { width: 2 },
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
            { xAxis: periodo.finSerie },
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
          label: { show: false },
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
        formatter: (value: string) => format(parseISO(value), 'MM/yyyy'),
        rotate: 45,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: labelColor,
        formatter: (value: number) =>
          value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      },
    },
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        handleSize: '80%',
        handleStyle: { color: colors.sky[500] },
      },
      { type: 'inside', start: 0, end: 100 },
    ],
  }
}

function opcionesAlineado(seriesData: any[], periodos: any[], labelColor: string, labelBg: string) {
  const { categorias, series } = seriesAlineadasPorMandato(seriesData, periodos)
  const meta = Object.fromEntries(series.map(s => [s.name, s.puntos]))

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      order: 'valueDesc',
      formatter: (params: any) => {
        const mes = Number(params[0]?.axisValue)
        const filas = [...params]
          .filter((p: any) => p.value != null && !Number.isNaN(Number(p.value)))
          .sort((a: any, b: any) => Number(b.value) - Number(a.value))
          .map((p: any) => {
            const punto = meta[p.seriesName]?.[mes]
            const fecha = punto
              ? format(parseISO(punto.fecha), 'MMM yyyy', { locale: es })
              : ''
            return `<div class="flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${p.color}"></span>
              <span class="font-medium">${p.seriesName}:</span>
              <span class="font-bold">${Number(p.value).toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
              ${fecha ? `<span class="text-xs text-gray-500">(${fecha})</span>` : ''}
            </div>`
          })
          .join('')

        return `<div class="flex flex-col gap-1">
          <div class="font-semibold">Mes ${mes} del mandato</div>
          ${filas}
        </div>`
      },
    },
    legend: {
      type: 'scroll',
      left: 'left',
      top: 0,
      data: series.map(s => s.name),
      textStyle: { color: labelColor },
    },
    toolbox: {
      top: 20,
      right: 10,
      feature: {
        dataZoom: { yAxisIndex: 'none' },
        restore: {},
        saveAsImage: {},
      },
    },
    grid: {
      top: 72,
      left: 48,
      right: 150,
      bottom: 72,
    },
    series: series.map(({ name, type, connectNulls, data, itemStyle, lineStyle, symbol, symbolSize }) => {
      let ultimoIndice = -1
      for (let i = 0; i < data.length; i++) {
        if (data[i] != null)
          ultimoIndice = i
      }

      return {
        name,
        type,
        connectNulls,
        triggerLineEvent: true,
        showSymbol: true,
        data: data.map((valor, index) => {
          if (index !== ultimoIndice || valor == null)
            return valor

          return {
            value: valor,
            label: {
              show: true,
              position: 'right',
              distance: 8,
              formatter: name,
              color: itemStyle.color,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: labelBg,
              padding: [2, 4],
              borderRadius: 2,
            },
          }
        }),
        itemStyle,
        lineStyle: {
          ...lineStyle,
          width: 2.5,
          opacity: 0.85,
        },
        symbol,
        symbolSize,
        emphasis: {
          focus: 'series',
          blurScope: 'coordinateSystem',
          scale: true,
          lineStyle: {
            width: 4.5,
            opacity: 1,
          },
          itemStyle: {
            opacity: 1,
          },
          endLabel: {
            show: true,
            fontWeight: 700,
          },
        },
        blur: {
          lineStyle: {
            opacity: 0.12,
            width: 1.5,
          },
          itemStyle: {
            opacity: 0.12,
          },
          label: {
            opacity: 0.2,
          },
        },
        labelLayout: {
          moveOverlap: 'shiftY',
        },
      }
    }),
    xAxis: {
      type: 'category',
      name: 'Mes del mandato',
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: { color: labelColor },
      data: categorias,
      axisLabel: {
        color: labelColor,
        formatter: (value: number | string) => `M${value}`,
      },
    },
    yAxis: {
      type: 'value',
      name: 'ICG',
      nameTextStyle: { color: labelColor },
      axisLabel: {
        color: labelColor,
        formatter: (value: number) =>
          value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      },
    },
    dataZoom: [
      {
        type: 'slider',
        start: 0,
        end: 100,
        handleSize: '80%',
        handleStyle: { color: colors.sky[500] },
      },
      { type: 'inside', start: 0, end: 100 },
    ],
  }
}

async function cargarDatos() {
  cargando.value = true
  const seriesData = await fetchIcg()
  const fechasIcg = seriesData.map((item: any) => item.fecha)
  icgData.value = seriesData
  asuncionesData.value = asuncionesEnSerie(
    await fetchAsuncionesPresidenciales(),
    fechasIcg,
  )
  periodosData.value = periodosEnSerie(await fetchPresidentes(), fechasIcg)
  cargando.value = false
}

function valorEnPunto(dato: any) {
  if (dato == null)
    return null
  if (typeof dato === 'object' && 'value' in dato)
    return dato.value
  return dato
}

let ultimaSerieResaltada = -1
let rafResaltado: number | null = null

function resaltarSerieMasCercana(event: any) {
  if (modo.value !== 'alineado')
    return

  if (rafResaltado != null)
    cancelAnimationFrame(rafResaltado)

  rafResaltado = requestAnimationFrame(() => {
    rafResaltado = null

    const chart = getInstance?.()
    if (!chart)
      return

    const punto = chart.convertFromPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY])
    if (!punto)
      return

    const [xRaw, yValor] = punto
    if (yValor == null || Number.isNaN(yValor))
      return

    const option = chart.getOption?.()
    const series = option?.series
    if (!Array.isArray(series) || !series.length)
      return

    const categorias = option?.xAxis?.[0]?.data || []
    if (!categorias.length)
      return

    const xIndex = Math.max(0, Math.min(categorias.length - 1, Math.round(xRaw)))

    let mejorSerie = -1
    let mejorDistancia = Infinity

    series.forEach((serie: any, index: number) => {
      const valor = valorEnPunto(serie.data?.[xIndex])
      if (valor == null || Number.isNaN(Number(valor)))
        return

      const distancia = Math.abs(Number(valor) - yValor)
      if (distancia < mejorDistancia) {
        mejorDistancia = distancia
        mejorSerie = index
      }
    })

    if (mejorSerie < 0)
      return

    const yAxis = option?.yAxis?.[0]
    const yMin = Number(yAxis?.min ?? 0)
    const yMax = Number(yAxis?.max ?? 3.5)
    const umbral = Math.max(0.12, (yMax - yMin) * 0.07)
    if (mejorDistancia > umbral) {
      if (ultimaSerieResaltada >= 0) {
        chart.dispatchAction({ type: 'downplay' })
        ultimaSerieResaltada = -1
      }
      return
    }

    if (mejorSerie === ultimaSerieResaltada)
      return

    chart.dispatchAction({ type: 'downplay' })
    chart.dispatchAction({
      type: 'highlight',
      seriesIndex: mejorSerie,
    })
    ultimaSerieResaltada = mejorSerie
  })
}

function limpiarResaltadoSeries() {
  const chart = getInstance?.()
  if (!chart)
    return
  chart.dispatchAction({ type: 'downplay' })
  ultimaSerieResaltada = -1
}

function enlazarResaltadoAlineado() {
  const chart = getInstance?.()
  const zr = chart?.getZr?.()
  if (!zr)
    return

  zr.off('mousemove', resaltarSerieMasCercana)
  zr.off('globalout', limpiarResaltadoSeries)

  if (modo.value !== 'alineado')
    return

  zr.on('mousemove', resaltarSerieMasCercana)
  zr.on('globalout', limpiarResaltadoSeries)
}

async function setChartOptions() {
  const seriesData = icgData.value
  if (!seriesData.length)
    return

  const labelColor = theme.value === 'dark' ? colors.gray[100] : colors.gray[800]
  const labelBg = theme.value === 'dark' ? colors.gray[900] : colors.white
  const bordeAsuncion
    = theme.value === 'dark' ? colors.amber[400] : colors.amber[600]

  const options = modo.value === 'alineado'
    ? opcionesAlineado(seriesData, periodosData.value, labelColor, labelBg)
    : opcionesCronologico(
        seriesData,
        asuncionesData.value,
        periodosData.value,
        labelColor,
        labelBg,
        bordeAsuncion,
      )

  setOptions(options as any)
  await nextTick()
  enlazarResaltadoAlineado()
}

onMounted(async () => {
  await cargarDatos()
  await setChartOptions()
})
</script>

<template>
  <div class="not-prose flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="m-0">
        Índice de Confianza en el Gobierno (ICG)
      </h3>

      <div class="flex items-center gap-3 text-sm">
        <label class="flex cursor-pointer items-center gap-1.5">
          <input
            v-model="modo"
            type="radio"
            value="cronologico"
            class="cursor-pointer"
          >
          <span>Cronológico</span>
        </label>
        <label class="flex cursor-pointer items-center gap-1.5">
          <input
            v-model="modo"
            type="radio"
            value="alineado"
            class="cursor-pointer"
          >
          <span>Mandatos alineados</span>
        </label>
        <span
          v-if="cargando"
          class="h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-sky-500"
        />
      </div>
    </div>

    <p
      v-if="modo === 'alineado'"
      class="m-0 text-xs text-gray-500 dark:text-gray-400"
    >
      Cada curva empieza en el mes 0 (inicio del mandato) para comparar trayectorias del ICG entre presidentes.
    </p>

    <div ref="chartRef" class="h-[50rem]" />
  </div>
</template>

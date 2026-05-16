import * as XLSX from 'xlsx'
import { obtenerFilasDeSheets } from '@/utils/gsheets.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerLetras',
  tipo: 'extraccion',
})

const PAGINA_COLOCACIONES =
  'https://www.argentina.gob.ar/economia/finanzas/deudapublica/colocacionesdedeuda'

const URL_BASE = 'https://www.argentina.gob.ar'

const CODIGOS_MES = {
  E: 0,
  F: 1,
  M: 2,
  A: 3,
  Y: 4,
  J: 5,
  L: 6,
  G: 7,
  S: 8,
  O: 9,
  N: 10,
  D: 11,
}

export function parsearVencimientoTicker(ticker) {
  if (ticker.length < 5) return undefined

  const tickerBase = ticker.slice(0, 5)
  const tipo = tickerBase[0]

  if (tipo !== 'S' && tipo !== 'T') return undefined

  const cadeniaDia = tickerBase.slice(1, 3)
  const codigoMes = tickerBase[3]
  const digitoAnio = tickerBase[4]

  const dia = parseInt(cadeniaDia)
  const mes = CODIGOS_MES[codigoMes]
  const ultimoDigitoAnio = parseInt(digitoAnio)

  if (isNaN(dia) || mes === undefined || isNaN(ultimoDigitoAnio))
    return undefined

  const anioActual = new Date().getFullYear()
  const decadaActual = Math.floor(anioActual / 10) * 10
  let anio = decadaActual + ultimoDigitoAnio

  if (anio < anioActual - 1) anio += 10

  const fecha = new Date(anio, mes, dia)

  if (isNaN(fecha.getTime())) return undefined

  return fecha.toISOString().split('T')[0]
}

export function extraerTem(cupon) {
  if (!cupon || typeof cupon !== 'string') return null

  const coincidencia = cupon.match(/capitalizable\s+([\d,.]+)\s*%/)

  if (!coincidencia) return null

  return parseFloat(coincidencia[1].replace(',', '.'))
}

export function aFechaIso(valor) {
  if (!valor) return null

  if (valor instanceof Date) return valor.toISOString().split('T')[0]

  if (typeof valor === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor

    const coincidenciaDMA = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

    if (coincidenciaDMA)
      return `${coincidenciaDMA[3]}-${coincidenciaDMA[2].padStart(2, '0')}-${coincidenciaDMA[1].padStart(2, '0')}`

    const coincidenciaMDA = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)

    if (coincidenciaMDA) {
      const aa = parseInt(coincidenciaMDA[3])
      const anio = aa <= 50 ? 2000 + aa : 1900 + aa

      return `${anio}-${coincidenciaMDA[1].padStart(2, '0')}-${coincidenciaMDA[2].padStart(2, '0')}`
    }
  }

  return null
}

export function dias360(fecha1, fecha2) {
  const [a1, m1, d1] = fecha1.split('-').map(Number)

  const [a2, m2, d2] = fecha2.split('-').map(Number)

  const dia1 = Math.min(d1, 30)
  const dia2 = dia1 === 30 ? Math.min(d2, 30) : d2

  return (a2 - a1) * 360 + (m2 - m1) * 30 + (dia2 - dia1)
}

export function calcularVpv(fechaEmision, fechaVencimiento, tem) {
  const d360 = dias360(fechaEmision, fechaVencimiento)
  const t = d360 / 30

  return Math.round(100 * Math.pow(1 + tem / 100, t) * 100000) / 100000
}

async function obtenerTickersActivos() {
  const [notas, bonos] = await Promise.all([
    fetch('https://data912.com/live/arg_notes').then(r => r.json()),
    fetch('https://data912.com/live/arg_bonds').then(r => r.json()),
  ])

  const vencimientoATicker = new Map()

  for (const elemento of [...(notas || []), ...(bonos || [])]) {
    const simbolo = elemento.symbol

    if (!simbolo || !simbolo.match(/^[ST]\d{2}[EFMAYLGJSOND]\d/)) continue

    const vencimiento = parsearVencimientoTicker(simbolo)

    if (vencimiento) vencimientoATicker.set(vencimiento, simbolo)
  }

  return vencimientoATicker
}

async function obtenerUrlsExcel() {
  const respuesta = await fetch(PAGINA_COLOCACIONES)
  const html = await respuesta.text()
  const coincidencias = [
    ...html.matchAll(/href="([^"]*colocaciones[^"]*\.xlsx[^"]*)"/gi),
  ]

  const urls = coincidencias
    .map(m => {
      const href = m[1].replace(/^blank:#/, '')
      return href.startsWith('http') ? href : `${URL_BASE}${href}`
    })
    .filter(Boolean)

  return [...new Set(urls)]
}

export async function extraerLetrasDesdeRendimientos() {
  try {
    const respuesta = await fetch('https://rendimientos.co/config.json')

    if (!respuesta.ok) return []

    const data = await respuesta.json()
    const letras = data.lecaps && data.lecaps.letras ? data.lecaps.letras : []

    const especiales =
      data.lecaps && data.lecaps.especiales ? data.lecaps.especiales : []

    const boncaps =
      data.lecaps && data.lecaps.boncaps ? data.lecaps.boncaps : []

    const todos = [...letras, ...especiales, ...boncaps]

    return todos
      .filter(l => l.activo !== false)
      .map(l => ({
        ticker: l.ticker,
        fechaVencimiento: l.fecha_vencimiento,
        vpv: l.pago_final,
        fechaEmision: null,
        tem: null,
      }))
  } catch (error) {
    logError(log, error)
    return []
  }
}

async function parsearBufferExcel(buffer, vencimientoATicker) {
  const libro = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
  })

  const resultados = []
  const vistos = new Set()

  for (const nombreHoja of ['Letras', 'Bonos']) {
    const hoja = libro.Sheets[nombreHoja]

    if (!hoja) continue

    const filas = XLSX.utils.sheet_to_json(hoja, {
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    })

    for (let i = 2; i < filas.length; i++) {
      const fila = filas[i]
      const emisionBruta = fila[1]
      const vencimientoBruto = fila[2]
      const cupon = fila[3]

      if (!emisionBruta || !vencimientoBruto) continue

      const fechaEmision = aFechaIso(emisionBruta)
      const fechaVencimiento = aFechaIso(vencimientoBruto)

      if (!fechaEmision || !fechaVencimiento) continue

      const ticker = vencimientoATicker.get(fechaVencimiento)

      if (!ticker) continue

      const tem = extraerTem(cupon)

      if (tem === null) continue

      const clave = `${ticker}:${fechaEmision}:${tem}`

      if (vistos.has(clave)) continue

      vistos.add(clave)

      resultados.push({
        ticker,
        fechaEmision,
        fechaVencimiento,
        tem,
        vpv: calcularVpv(fechaEmision, fechaVencimiento, tem),
      })
    }
  }

  return resultados
}

export function parsearFilaSheets(fila) {
  const ticker = fila[0] && fila[0].trim()

  if (!ticker) return null

  const fechaEmision =
    fila[1] && fila[1].trim() ? aFechaIso(fila[1].trim()) : null

  const fechaVencimientoBruta = fila[2] && fila[2].trim()
  const temBruto = fila[3] && fila[3].trim()
  const vpvBruto = fila[4] && fila[4].trim()

  let fechaVencimiento = fechaVencimientoBruta
    ? aFechaIso(fechaVencimientoBruta)
    : null

  if (!fechaVencimiento) {
    const vencimientoDeTicket = parsearVencimientoTicker(ticker)

    if (vencimientoDeTicket) fechaVencimiento = vencimientoDeTicket
  }

  const tem = temBruto ? parseFloat(temBruto) : null
  let vpv = vpvBruto ? parseFloat(vpvBruto) : null

  if (
    vpv === null &&
    fechaEmision &&
    fechaVencimiento &&
    tem !== null &&
    !isNaN(tem)
  ) {
    vpv = calcularVpv(fechaEmision, fechaVencimiento, tem)
  }

  return {
    ticker,
    fechaEmision,
    fechaVencimiento,
    tem,
    vpv,
  }
}

export async function extraerLetrasDesdeSheets() {
  const spreadsheetId = import.meta.env.VITE_GSHEETS_LETRAS_SPREADSHEET_ID

  if (!spreadsheetId) return []

  try {
    const filas = await obtenerFilasDeSheets(spreadsheetId, 'A:E')

    if (filas.length <= 1) return []

    const resultado = []

    for (var i = 1; i < filas.length; i++) {
      const item = parsearFilaSheets(filas[i])

      if (item) resultado.push(item)
    }

    return resultado
  } catch (error) {
    logError(log, error)
    return []
  }
}

async function extraerLetrasDesdeExcel() {
  const vencimientoATicker = await obtenerTickersActivos()
  const urls = await obtenerUrlsExcel()
  const todosDatos = new Map()

  for (const url of urls) {
    const respuesta = await fetch(url)

    if (!respuesta.ok) continue

    const buffer = await respuesta.arrayBuffer()
    const instrumentos = await parsearBufferExcel(buffer, vencimientoATicker)

    for (const instrumento of instrumentos) {
      if (!todosDatos.has(instrumento.ticker))
        todosDatos.set(instrumento.ticker, [])

      todosDatos.get(instrumento.ticker).push(instrumento)
    }
  }

  const resultado = []

  for (const [, entradas] of todosDatos) {
    const mejor = [...entradas].sort((a, b) => {
      if (a.fechaEmision !== b.fechaEmision)
        return a.fechaEmision < b.fechaEmision ? -1 : 1

      return a.tem - b.tem
    })[0]

    resultado.push(mejor)
  }

  return resultado
}

export async function extraerLetras() {
  try {
    const [datosExcel, datosSheets, datosRendimientos] = await Promise.all([
      extraerLetrasDesdeExcel(),
      extraerLetrasDesdeSheets(),
      extraerLetrasDesdeRendimientos(),
    ])

    const mapa = new Map()

    for (const item of datosExcel) {
      mapa.set(item.ticker, { ...item })
    }

    for (const item of datosSheets) {
      const base = mapa.get(item.ticker) || {
        fechaEmision: null,
        fechaVencimiento: null,
        tem: null,
        vpv: null,
      }

      const merged = {
        ...base,
        ticker: item.ticker,
      }

      if (item.fechaEmision) merged.fechaEmision = item.fechaEmision

      if (item.fechaVencimiento) merged.fechaVencimiento = item.fechaVencimiento

      if (item.tem !== null && !isNaN(item.tem)) merged.tem = item.tem

      if (item.vpv !== null && !isNaN(item.vpv)) merged.vpv = item.vpv

      mapa.set(item.ticker, merged)
    }

    for (const item of datosRendimientos) {
      const base = mapa.get(item.ticker) || {
        fechaEmision: null,
        fechaVencimiento: null,
        tem: null,
        vpv: null,
      }

      const merged = {
        ...base,
        ...item,
      }

      mapa.set(item.ticker, merged)
    }

    return [...mapa.values()].filter(
      item =>
        item.fechaVencimiento &&
        item.vpv !== null &&
        item.vpv !== undefined &&
        !isNaN(item.vpv),
    )
  } catch (error) {
    logError(log, error)
    throw error
  }
}

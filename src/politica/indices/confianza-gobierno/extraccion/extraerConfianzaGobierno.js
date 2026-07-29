import axios from 'axios'
import * as XLSX from 'xlsx'
import { parse } from 'date-fns'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerConfianzaGobierno',
  tipo: 'extraccion',
})

export const UTDT_ICG_DATOS_URL =
  'https://www.utdt.edu/ver_contenido.php?id_contenido=17876&id_item_menu=28756'

export const UTDT_BASE_URL = 'https://www.utdt.edu'

const MESES_ES = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
}

export async function extraerConfianzaGobierno() {
  try {
    const excelUrl = await obtenerUrlExcelIcg()
    const buffer = await descargarExcel(excelUrl)
    return parsearWorkbookIcg(buffer)
  } catch (error) {
    logError(log, error)
    return []
  }
}

export async function obtenerUrlExcelIcg(html) {
  if (!html) {
    const respuesta = await axios.get(UTDT_ICG_DATOS_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 30000,
    })
    html = respuesta.data
  }

  const coincidencias = [
    ...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ]

  for (const coincidencia of coincidencias) {
    const href = coincidencia[1]
    const texto = coincidencia[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

    const esExcel =
      /\.xls(x)?(\?|$)/i.test(href) || /download\.php\?fname=/i.test(href)
    const esEvolucion =
      /evoluci[oó]n\s+mensual\s+del\s+icg/i.test(texto) ||
      (/icg/i.test(texto) && /excel/i.test(texto) && /evoluci/i.test(texto))

    if (esExcel && esEvolucion) {
      return new URL(href, UTDT_BASE_URL).toString()
    }
  }

  // Fallback: primer download.php con .xls en el HTML de datos ICG
  const fallback = html.match(
    /href=["']([^"']*download\.php\?fname=[^"']+\.xls)["']/i,
  )
  if (fallback) {
    return new URL(fallback[1], UTDT_BASE_URL).toString()
  }

  throw new Error('No se encontró el Excel de Evolución Mensual del ICG en UTDT')
}

async function descargarExcel(url) {
  const respuesta = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      Accept:
        'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      Referer: UTDT_ICG_DATOS_URL,
    },
    timeout: 60000,
  })

  return Buffer.from(respuesta.data)
}

export function parsearWorkbookIcg(buffer) {
  const libro = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
  })

  const porFecha = new Map()

  for (const nombreHoja of libro.SheetNames) {
    const hoja = libro.Sheets[nombreHoja]
    if (!hoja) continue

    const filas = XLSX.utils.sheet_to_json(hoja, {
      header: 1,
      defval: null,
      raw: true,
    })

    const { filaFechas, filaIcg, filaVariacion } = ubicarFilasIcg(filas)
    if (!filaFechas || !filaIcg) continue

    for (let col = 0; col < filaFechas.length; col++) {
      const fecha = normalizarFechaIcg(filaFechas[col])
      const valor = normalizarNumero(filaIcg[col])

      if (!fecha || valor === null) continue

      const variacion = filaVariacion
        ? normalizarNumero(filaVariacion[col])
        : null

      porFecha.set(fecha, {
        fecha,
        valor,
        ...(variacion !== null ? { variacion } : {}),
      })
    }
  }

  return [...porFecha.values()].sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0,
  )
}

function ubicarFilasIcg(filas) {
  let filaFechas = null
  let filaIcg = null
  let filaVariacion = null

  for (const fila of filas) {
    if (!Array.isArray(fila)) continue

    const etiqueta = String(fila[1] ?? '')
      .trim()
      .toLowerCase()

    if (etiqueta === 'icg') {
      filaIcg = fila
      continue
    }

    if (etiqueta.startsWith('variaci')) {
      filaVariacion = fila
      continue
    }

    const fechasEnFila = fila.filter(celda => normalizarFechaIcg(celda)).length
    if (fechasEnFila >= 3) {
      filaFechas = fila
    }
  }

  return { filaFechas, filaIcg, filaVariacion }
}

function fechaYmd(anio, mesIndex0, dia = 1) {
  return `${anio}-${String(mesIndex0 + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function normalizarFechaIcg(celda) {
  if (celda == null || celda === '') return null

  if (celda instanceof Date && !Number.isNaN(celda.getTime())) {
    // xlsx con cellDates entrega medianoche UTC; usar UTC para no correr el día en ART
    return fechaYmd(
      celda.getUTCFullYear(),
      celda.getUTCMonth(),
      celda.getUTCDate(),
    )
  }

  if (typeof celda === 'number' && Number.isFinite(celda)) {
    // Años sueltos del encabezado (2002, 2023, …) no son seriales Excel
    if (Number.isInteger(celda) && celda >= 1900 && celda <= 2100) {
      return null
    }
    const parseado = XLSX.SSF.parse_date_code(celda)
    if (!parseado) return null
    return fechaYmd(parseado.y, parseado.m - 1, parseado.d)
  }

  if (typeof celda === 'string') {
    const texto = celda.trim()
    if (!texto) return null

    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
      return texto.slice(0, 10)
    }

    // jul-26 / jul-2026 / jul 26
    const matchMesAnio = texto.match(
      /^([a-záéíóú]{3})[-\s./]?(\d{2}|\d{4})$/i,
    )
    if (matchMesAnio) {
      const mes = MESES_ES[matchMesAnio[1].toLowerCase().slice(0, 3)]
      if (mes === undefined) return null
      let anio = Number(matchMesAnio[2])
      if (anio < 100) anio += anio >= 70 ? 1900 : 2000
      return fechaYmd(anio, mes, 1)
    }

    try {
      const d = parse(texto, 'dd/MM/yyyy', new Date())
      if (Number.isNaN(d.getTime())) return null
      return fechaYmd(d.getFullYear(), d.getMonth(), d.getDate())
    } catch {
      return null
    }
  }

  return null
}

function normalizarNumero(celda) {
  if (celda == null || celda === '') return null
  if (typeof celda === 'number' && Number.isFinite(celda)) {
    return redondear(celda)
  }
  if (typeof celda === 'string') {
    const limpio = celda.trim().replace(',', '.')
    if (!limpio) return null
    const n = Number(limpio)
    return Number.isFinite(n) ? redondear(n) : null
  }
  return null
}

function redondear(n) {
  return Math.round(n * 1e6) / 1e6
}

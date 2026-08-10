import axios from 'axios'
import { logGrupo, logError } from '@/log.js'
import { parsePorcentaje } from '@/finanzas/creditos/prestamos-personales/extraccion/parsePorcentaje.js'

const log = logGrupo({
  fuente: 'extraerPrestamosPersonalesBcra',
  tipo: 'extraccion',
})

export const URL_PERSONALES_BCRA =
  'https://www.bcra.gob.ar/archivos/Pdfs/BCRAyVos/PERSONALES.CSV'

/** Alias cortos para join soft con el ranking scrapeado. */
const ALIAS_ENTIDAD = {
  7: 'GALICIA',
  11: 'BNA',
  17: 'BBVA',
  27: 'SUPERVIELLE',
  72: 'SANTANDER',
  285: 'MACRO',
  384: 'UALA',
  72634: 'MERCADOPAGO',
}

const COLS = {
  codigoEntidad: 'Código de Entidad',
  descripcionEntidad: 'Descripción de Entidad',
  fechaInformacion: 'Fecha de Información',
  producto: 'Nombre completo del Préstamo Personal',
  productoCorto: 'Nombre corto del Préstamo Personal',
  denominacion: 'Denominación',
  montoMax: 'Monto máximo otorgable',
  montoMin: 'Monto mínimo otorgable',
  plazoMax: 'Plazo máximo otorgable',
  ingresoMin: 'Ingreso mínimo mensual solicitado',
  antiguedad: 'Antigüedad laboral mínima (meses)',
  edadMax: 'Edad máxima solicitada',
  afectacion: 'Relación cuota/ingreso (%)',
  beneficiario: 'Beneficiario',
  cargoCancelacion: 'Cargo máximo por cancelación anticipada',
  teaMax: 'Tasa efectiva anual máxima',
  tipoTasa: 'Tipo de Tasa',
  cftTeaMax: 'Costo financiero efectivo total máximo',
  cuotaInicial: 'Cuota inicial a plazo máximo cada $10.000',
  territorio: 'Territorio de validez de la oferta',
  notas: 'Más información',
}

/**
 * @param {string} texto
 * @returns {string[][]}
 */
function parsearCsvPuntoYComa(texto) {
  const filas = []
  const lineas = String(texto).replace(/^\uFEFF/, '').split(/\r?\n/)

  for (const linea of lineas) {
    if (!linea.trim()) continue

    const celdas = []
    let actual = ''
    let entreComillas = false

    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i]

      if (ch === '"') {
        if (entreComillas && linea[i + 1] === '"') {
          actual += '"'
          i++
        } else {
          entreComillas = !entreComillas
        }
      } else if (ch === ';' && !entreComillas) {
        celdas.push(actual)
        actual = ''
      } else {
        actual += ch
      }
    }

    celdas.push(actual)
    filas.push(celdas)
  }

  return filas
}

/**
 * @param {string|null|undefined} texto
 * @returns {number|null}
 */
function parseEntero(texto) {
  if (texto === null || texto === undefined) return null

  const limpio = String(texto).replace(/\s/g, '').trim()

  if (!limpio) return null

  const valor = Number.parseInt(limpio.replace(/\./g, ''), 10)

  return Number.isNaN(valor) ? null : valor
}

/**
 * Número AR con coma decimal (sin convertir a tasa).
 * @param {string|null|undefined} texto
 * @returns {number|null}
 */
function parseNumeroAr(texto) {
  if (texto === null || texto === undefined) return null

  let limpio = String(texto).replace(/\s/g, '').trim()

  if (!limpio || limpio === ',') return null

  if (limpio.includes(',')) {
    limpio = limpio.replace(/\./g, '').replace(',', '.')
  }

  const valor = Number.parseFloat(limpio)

  return Number.isNaN(valor) ? null : valor
}

/**
 * @param {string|null|undefined} denominacion
 * @returns {'ARS'|'USD'|'UVA'|null}
 */
export function monedaDesdeDenominacion(denominacion) {
  const d = String(denominacion || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

  if (d === 'pesos') return 'ARS'
  if (d.includes('dolar')) return 'USD'
  if (d === 'uva') return 'UVA'

  return null
}

/**
 * @param {string|null|undefined} beneficiario
 * @returns {boolean|null}
 */
export function requiereClienteDeBeneficiario(beneficiario) {
  const t = String(beneficiario || '')
    .trim()
    .toLowerCase()

  if (!t) return null

  if (t.includes('todos los beneficiarios')) return false

  if (t.includes('cliente')) return true

  return false
}

/**
 * @param {string|null|undefined} tipo
 * @returns {string|null}
 */
function normalizarTipoTasa(tipo) {
  const t = String(tipo || '')
    .trim()
    .toLowerCase()

  if (!t) return null

  return t
}

/**
 * @param {number|null} porcentaje
 * @returns {string|null}
 */
function formatearAfectacion(porcentaje) {
  if (porcentaje === null || porcentaje === undefined) return null

  const entero = Number.isInteger(porcentaje)
    ? String(porcentaje)
    : String(porcentaje).replace(/\.0+$/, '')

  return `${entero}%`
}

/**
 * @param {Record<string, string>} mapa
 * @param {string[]} celdas
 * @returns {Record<string, string>}
 */
function filaAObjeto(mapa, celdas) {
  const out = {}

  for (const [clave, indice] of Object.entries(mapa)) {
    out[clave] = celdas[indice] ?? ''
  }

  return out
}

/**
 * Parsea el CSV BCRA PERSONALES (latin1 / `;`).
 * Por defecto solo publica ARS con TEA o CFT máximos parseables.
 *
 * @param {string} texto
 * @param {{ monedas?: Array<'ARS'|'USD'|'UVA'> }} [opciones]
 * @returns {Array<Record<string, unknown>>}
 */
export function parsearPrestamosPersonalesBcra(texto, opciones = {}) {
  const monedasPermitidas = opciones.monedas ?? ['ARS']
  const filas = parsearCsvPuntoYComa(texto)

  if (filas.length < 2) return []

  const cabecera = filas[0].map((c) => c.trim())
  const indices = {}

  for (const [clave, nombreCol] of Object.entries(COLS)) {
    const idx = cabecera.indexOf(nombreCol)

    if (idx === -1) {
      return []
    }

    indices[clave] = idx
  }

  const items = []

  for (let i = 1; i < filas.length; i++) {
    const raw = filaAObjeto(indices, filas[i])
    const moneda = monedaDesdeDenominacion(raw.denominacion)

    if (!moneda || !monedasPermitidas.includes(moneda)) continue

    const teaMax = parsePorcentaje(raw.teaMax)
    const cftTeaMax = parsePorcentaje(raw.cftTeaMax)

    if (teaMax === null && cftTeaMax === null) continue

    const codigoEntidad = String(raw.codigoEntidad || '').trim()

    if (!codigoEntidad) continue

    const descripcion = String(raw.descripcionEntidad || '').trim()
    const alias = ALIAS_ENTIDAD[codigoEntidad] || null
    const beneficiario = String(raw.beneficiario || '').trim() || null
    const afectacion = parseNumeroAr(raw.afectacion)
    const cargo = parsePorcentaje(raw.cargoCancelacion)
    const notas = String(raw.notas || '').trim() || null
    const territorio = String(raw.territorio || '').trim() || null

    items.push({
      codigoEntidad,
      entidad: alias || descripcion,
      nombreComercial: descripcion,
      producto: String(raw.producto || '').trim() || null,
      productoCorto: String(raw.productoCorto || '').trim() || null,
      moneda,
      teaMax,
      cftTeaMax,
      tipoTasa: normalizarTipoTasa(raw.tipoTasa),
      requiereCliente: requiereClienteDeBeneficiario(beneficiario),
      condiciones: beneficiario,
      vigenciaDesde: String(raw.fechaInformacion || '').trim() || null,
      enlace: URL_PERSONALES_BCRA,
      metadata: {
        montoMin: parseEntero(raw.montoMin),
        montoMax: parseEntero(raw.montoMax),
        plazoMaxMeses: parseEntero(raw.plazoMax),
        ingresoMinMensual: parseEntero(raw.ingresoMin),
        antiguedadLaboralMinMeses: parseEntero(raw.antiguedad),
        edadMax: parseEntero(raw.edadMax),
        afectacionIngresos: formatearAfectacion(afectacion),
        cargoCancelacionAnticipada: cargo,
        cuotaInicialPor10000: parseNumeroAr(raw.cuotaInicial),
        territorio,
        notas,
        fuente: 'bcra-csv',
      },
    })
  }

  items.sort((a, b) => {
    const ca = a.cftTeaMax ?? a.teaMax ?? Number.POSITIVE_INFINITY
    const cb = b.cftTeaMax ?? b.teaMax ?? Number.POSITIVE_INFINITY

    if (ca !== cb) return ca - cb

    return String(a.entidad).localeCompare(String(b.entidad), 'es')
  })

  return items
}

export async function extraerPrestamosPersonalesBcra() {
  try {
    const respuesta = await axios.get(URL_PERSONALES_BCRA, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 60000,
      headers: {
        Accept: 'text/csv,text/plain,*/*',
        'User-Agent':
          'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      },
    })

    const texto = Buffer.from(respuesta.data).toString('latin1')

    return parsearPrestamosPersonalesBcra(texto)
  } catch (error) {
    logError(log, error)
    return []
  }
}

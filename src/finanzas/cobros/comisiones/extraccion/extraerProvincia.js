import axios from 'axios'
import * as cheerio from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const PROVINCIA_ADHESION_URL =
  'https://www.bancoprovincia.com.ar/web/adhesion_comercios'

const log = logGrupo({
  fuente: 'extraerProvinciaComisionesCobro',
  tipo: 'extraccion',
})

const CONDICION_QR_TARJETAS =
  'También aplica a QR con tarjetas de crédito y débito (mismos aranceles que Tarjeta Presente).'

const CONDICION_CATEGORIA =
  'Acreditación en 8, 10 o 18 días hábiles según la categoría del comercio para tarjetas de entidades financieras.'

/**
 * @param {string} texto
 * @returns {{
 *   tipo: string,
 *   plazo: number|null,
 *   label: string,
 *   plazos?: number[],
 * }}
 */
function parsearAcreditacionProvincia(texto) {
  const raw = String(texto).replace(/\s+/g, ' ').trim()
  const t = raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

  if (/inmediata/.test(t)) {
    return {
      tipo: 'inmediata',
      plazo: 0,
      label: 'Acreditación inmediata',
    }
  }

  if (/24\s*horas/.test(t)) {
    return {
      tipo: 'anticipada',
      plazo: 1,
      label: '24 horas hábiles',
    }
  }

  if (/48\s*horas/.test(t)) {
    return {
      tipo: 'estandar',
      plazo: 2,
      label: '48 horas hábiles',
    }
  }

  if (/8,\s*10\s*o\s*18/.test(t)) {
    return {
      tipo: 'estandar',
      plazo: 8,
      label: '8, 10 o 18 días hábiles',
      plazos: [8, 10, 18],
    }
  }

  return {
    tipo: 'desconocida',
    plazo: null,
    label: raw || null,
  }
}

/**
 * @param {string} nombre
 * @returns {'fiserv'|'payway'|null}
 */
function normalizarProcesador(nombre) {
  const n = String(nombre).toLowerCase()

  if (/pay/.test(n)) return 'payway'
  if (/fi?r?serv/.test(n)) return 'fiserv'

  return null
}

/**
 * @param {'fiserv'|'payway'} id
 * @returns {string}
 */
function labelProcesador(id) {
  return id === 'payway' ? 'Payway' : 'Fiserv'
}

/**
 * @param {string} marca
 * @returns {string|null}
 */
function labelMarca(marca) {
  if (!marca) return null

  const m = String(marca).toLowerCase()

  if (/amex|american/.test(m)) return 'Amex'
  if (/visa/.test(m)) return 'Visa'
  if (/master/.test(m)) return 'Mastercard'

  return marca
}

/**
 * @param {string} cuerpo
 * @returns {Array<{ pct: string, marca: string|null, texto: string }>}
 */
function extraerTarifas(cuerpo) {
  const texto = String(cuerpo).replace(/\s+/g, ' ').trim()
  /** @type {Array<{ pct: string, marca: string|null, texto: string }>} */
  const tarifas = []

  const branded = [
    ...texto.matchAll(
      /([\d]+(?:[.,]\d+)?)\s*%\s*\+?\s*IVA[^%]*?para\s+(VISA|MasterCard|Mastercard)/gi,
    ),
  ]

  if (branded.length) {
    for (const match of branded) {
      tarifas.push({
        pct: match[1],
        marca: match[2],
        texto: match[0],
      })
    }
  } else {
    const first = texto.match(/([\d]+(?:[.,]\d+)?)\s*%/)
    if (first) {
      tarifas.push({
        pct: first[1],
        marca: null,
        texto,
      })
    }
  }

  const amex = texto.match(/American Express[^.]*?([\d]+(?:[.,]\d+)?)\s*%/i)
  if (amex) {
    tarifas.push({
      pct: amex[1],
      marca: 'amex',
      texto: amex[0],
    })
  }

  return tarifas
}

/**
 * @param {string} titulo
 * @returns {{ productoBase: string, canal: string, medioPago: string }|null}
 */
function mapearTitulo(titulo) {
  const t = String(titulo).replace(/\s+/g, ' ').trim().toLowerCase()

  if (/clave\s+dni/.test(t)) {
    return {
      productoBase: 'Clave DNI',
      canal: 'qr',
      medioPago: 'qr_cuenta',
    }
  }

  if (/qr/.test(t) && /dinero en cuenta/.test(t)) {
    return {
      productoBase: 'QR dinero en cuenta',
      canal: 'qr',
      medioPago: 'qr_cuenta',
    }
  }

  if (/qr/.test(t) && /tarjetas/.test(t)) {
    return null
  }

  if (/d[eé]bito/.test(t)) {
    return {
      productoBase: 'Débito',
      canal: 'pos',
      medioPago: 'debito',
    }
  }

  if (/cr[eé]dito/.test(t) && /cuotas/.test(t)) {
    return {
      productoBase: 'Crédito en cuotas',
      canal: 'pos',
      medioPago: 'credito_cuotas',
    }
  }

  if (/cr[eé]dito/.test(t)) {
    return {
      productoBase: 'Crédito 1 pago',
      canal: 'pos',
      medioPago: 'credito',
    }
  }

  return null
}

/**
 * @param {object} params
 */
function filaProvincia({
  producto,
  canal,
  medioPago,
  arancelTexto,
  acreditacion,
  condiciones,
  metadata,
}) {
  const parsed = parseArancelTexto(arancelTexto)

  if (parsed.arancel === null) return null

  return crearComisionCobro({
    entidad: 'provincia',
    nombreComercial: 'Banco Provincia',
    producto,
    canal,
    medioPago,
    arancel: parsed.arancel,
    arancelEsTope: parsed.arancelEsTope,
    incluyeIva: parsed.incluyeIva,
    ivaAdicional: parsed.ivaAdicional,
    acreditacionTipo: acreditacion.tipo,
    acreditacionPlazoHabiles: acreditacion.plazo,
    acreditacionLabel: acreditacion.label,
    condiciones,
    enlace: PROVINCIA_ADHESION_URL,
    metadata: {
      fuenteUrl: PROVINCIA_ADHESION_URL,
      ...metadata,
    },
  })
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearProvincia(html) {
  const $ = cheerio.load(String(html))
  const $panel = $('.accordion-panel').filter((_, el) => {
    const heading = $(el).prev('.accordion').text()
    return /aranceles y plazos/i.test(heading)
  })

  const $items = ($panel.length ? $panel : $('#p5')).find('li')
  /** @type {Array<object>} */
  const comisiones = []

  $items.each((_, li) => {
    const $li = $(li)
    const titulo = $li.find('strong').first().text().replace(/\s+/g, ' ').trim()
    const texto = $li.text().replace(/\s+/g, ' ').trim()
    const mapped = mapearTitulo(titulo || texto)

    if (!mapped) return

    const segmentos = texto.split(/(?=(?:Fiserv|Firserv|Payway)\s*:)/i)
    const tieneProcesador = segmentos.some(s =>
      /^(?:Fiserv|Firserv|Payway)\s*:/i.test(s.trim()),
    )

    if (!tieneProcesador) {
      const fila = filaProvincia({
        producto: mapped.productoBase,
        canal: mapped.canal,
        medioPago: mapped.medioPago,
        arancelTexto: texto,
        acreditacion: parsearAcreditacionProvincia(texto),
        condiciones: null,
        metadata: {
          tituloOriginal: titulo,
        },
      })
      if (fila) comisiones.push(fila)
      return
    }

    for (const segmento of segmentos) {
      const chunk = segmento.trim()
      const procMatch = chunk.match(/^(Fiserv|Firserv|Payway)\s*:/i)

      if (!procMatch) continue

      const procesador = normalizarProcesador(procMatch[1])
      if (!procesador) continue

      const cuerpo = chunk.replace(/^(Fiserv|Firserv|Payway)\s*:/i, '').trim()
      const acreditacion = parsearAcreditacionProvincia(cuerpo)
      const tarifas = extraerTarifas(cuerpo)

      for (const tarifa of tarifas) {
        const marcaLabel = labelMarca(tarifa.marca)
        const producto = [
          mapped.productoBase,
          labelProcesador(procesador),
          marcaLabel,
        ]
          .filter(Boolean)
          .join(' ')
        const medioPago =
          tarifa.marca && /amex|american/i.test(tarifa.marca)
            ? 'amex'
            : mapped.medioPago

        const condiciones = [
          CONDICION_QR_TARJETAS,
          acreditacion.plazos ? CONDICION_CATEGORIA : null,
        ]
          .filter(Boolean)
          .join(' ')

        const arancelTexto =
          /\bIVA\b/i.test(cuerpo) && !/\bIVA\b/i.test(tarifa.texto)
            ? `${tarifa.texto} + IVA`
            : tarifa.texto

        const fila = filaProvincia({
          producto,
          canal: mapped.canal,
          medioPago,
          arancelTexto,
          acreditacion,
          condiciones,
          metadata: {
            tituloOriginal: titulo,
            adquirente: procesador,
            ...(marcaLabel ? { marca: marcaLabel } : {}),
            ...(acreditacion.plazos
              ? { plazosHabiles: acreditacion.plazos }
              : {}),
          },
        })

        if (fila) comisiones.push(fila)
      }
    }
  })

  return comisiones
}

async function fetchHtml() {
  const respuesta = await axios.get(PROVINCIA_ADHESION_URL, {
    responseType: 'text',
    timeout: 20000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  })

  return String(respuesta.data)
}

export async function extraerProvincia() {
  try {
    const html = await fetchHtml()
    const comisiones = parsearProvincia(html)

    logMensaje(log, 'Banco Provincia parseado', { filas: comisiones.length })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}

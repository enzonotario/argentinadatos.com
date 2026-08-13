import axios from 'axios'
import * as cheerio from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const VIUMI_URL = 'https://viumi.com.ar/'
export const VIUMI_COMISIONES_URL = 'https://viumi.com.ar/#s-comission'

const log = logGrupo({
  fuente: 'extraerViumiComisionesCobro',
  tipo: 'extraccion',
})

const CONDICION =
  'Comisiones sin IVA. Vigencia desde 04/06/2026. Publicadas para cobros con lector, celular, QR y link de pago.'

/**
 * @param {string} texto
 * @returns {number|null}
 */
function parseDiasViumi(texto) {
  const match = String(texto).match(/(\d+)\s*d[ií]as?/i)
  return match ? Number.parseInt(match[1], 10) : null
}

/**
 * @param {string} titulo
 */
function mapearMedioViumi(titulo) {
  const t = String(titulo).replace(/\s+/g, ' ').trim().toLowerCase()

  if (/prepaga/.test(t)) {
    return {
      producto: 'Prepaga',
      canal: 'pos',
      medioPago: 'prepaga',
    }
  }

  if (/alimentar/.test(t)) {
    return {
      producto: 'Alimentar',
      canal: 'pos',
      medioPago: 'otro',
    }
  }

  if (/d[eé]bito/.test(t)) {
    return {
      producto: 'Débito',
      canal: 'pos',
      medioPago: 'debito',
    }
  }

  if (/cr[eé]dito/.test(t)) {
    return {
      producto: 'Crédito',
      canal: 'pos',
      medioPago: 'credito',
    }
  }

  return null
}

/**
 * Empareja % con plazos: mayor arancel ↔ menor plazo.
 * El DOM de Prepagas no alterna comisión/plazo.
 * @param {string[]} celdas
 * @returns {Array<[string, string]>}
 */
function emparejarTasasYPlazos(celdas) {
  const tasas = celdas.filter(c => /%/.test(c))
  const plazos = celdas.filter(c => /d[ií]a/i.test(c))

  if (!tasas.length || tasas.length !== plazos.length) return []

  const tasasOrd = [...tasas].sort((a, b) => {
    const pa = parseArancelTexto(a).arancel ?? 0
    const pb = parseArancelTexto(b).arancel ?? 0
    return pb - pa
  })
  const plazosOrd = [...plazos].sort(
    (a, b) => (parseDiasViumi(a) ?? 0) - (parseDiasViumi(b) ?? 0),
  )

  return tasasOrd.map((tasa, i) => [tasa, plazosOrd[i]])
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearViumi(html) {
  const $ = cheerio.load(String(html))
  const $seccion = $('#s-comission').length ? $('#s-comission') : $('body')

  /** @type {Array<object>} */
  const comisiones = []

  $seccion
    .find('.div-block-74, .div-block-73, .div-block-35')
    .each((_, block) => {
      const $block = $(block)
      if ($block.hasClass('d-none') || $block.closest('.d-none').length) return

      const titulo = $block.find('.sub-subtitle').first().text()
      const medio = mapearMedioViumi(titulo)
      if (!medio) return

      const celdas = $block
        .find('.info-tabla')
        .map((__, el) =>
          $(el)
            .text()
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        )
        .get()
        .filter(Boolean)

      for (const [tasa, plazoTexto] of emparejarTasasYPlazos(celdas)) {
        const parsed = parseArancelTexto(`${tasa} + IVA`)
        if (parsed.arancel === null) continue

        const plazo = parseDiasViumi(plazoTexto)
        const tipo =
          plazo === 0
            ? 'inmediata'
            : plazo === 1
              ? 'anticipada'
              : plazo != null
                ? 'estandar'
                : 'desconocida'

        comisiones.push(
          crearComisionCobro({
            entidad: 'viumi',
            nombreComercial: 'Viumi',
            producto: medio.producto,
            canal: medio.canal,
            medioPago: medio.medioPago,
            arancel: parsed.arancel,
            arancelEsTope: false,
            incluyeIva: false,
            ivaAdicional: true,
            acreditacionTipo: tipo,
            acreditacionPlazoHabiles: plazo,
            acreditacionLabel: plazoTexto,
            condiciones: CONDICION,
            enlace: VIUMI_COMISIONES_URL,
            vigenciaDesde: '2026-06-04',
            metadata: {
              fuenteUrl: VIUMI_URL,
              tituloOriginal: titulo.replace(/\s+/g, ' ').trim(),
              celdaOriginal: `${tasa} ${plazoTexto}`,
            },
          }),
        )
      }
    })

  return comisiones
}

async function fetchAxios() {
  const respuesta = await axios.get(VIUMI_URL, {
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

async function obtenerHtml() {
  try {
    const html = await fetchAxios()
    if (parsearViumi(html).length) return html
    logMensaje(log, 'Viumi axios sin tablas, pruebo Firecrawl')
  } catch (error) {
    logMensaje(log, 'Viumi axios falló, pruebo Firecrawl', {
      errorMessage: error.message,
    })
  }

  if (!import.meta.env.VITE_FIRECRAWL_API_KEY) return ''

  const scraped = await scrapeHtmlWithFirecrawl(log, VIUMI_URL)
  return scraped.html || scraped.markdown || ''
}

export async function extraerViumi() {
  try {
    const html = await obtenerHtml()
    const comisiones = parsearViumi(html)

    logMensaje(log, 'Viumi parseado', { filas: comisiones.length })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}

import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { fetchDefuddleMarkdownFromUrl } from '@/shared/extraction/defuddle.js'

const log = logGrupo({
  fuente: 'extraerPlazoFijoUvaPagoPeriodico',
  tipo: 'extraccion',
})

const URL_BNA_PLAZO_FIJO_ELECTRONICO =
  'https://www.bna.com.ar/Personas/PlazoFijoElectronico'

const TITULO_TABLA =
  'PF TRAD.EN UVA CON PAGO INTERÉS SUBPERÍODOS DE 30 DÍAS'

export async function extraerPlazoFijoUvaPagoPeriodico() {
  try {
    const proveedores = [...(await extraerBna())]

    return proveedores
  } catch (error) {
    logError(log, error)
    return []
  }
}

async function extraerBna() {
  try {
    logMensaje(log, 'Consultando BNA via Defuddle')

    const markdown = await fetchDefuddleMarkdownFromUrl(
      URL_BNA_PLAZO_FIJO_ELECTRONICO,
    )
    const tasas = parsearTasasUvaPagoPeriodicoDesdeMarkdown(markdown)

    if (!tasas.length) {
      logMensaje(log, 'No se encontraron tasas en el markdown de Defuddle')
      return []
    }

    return [
      {
        id: 'bna',
        entidad: 'Banco de la Nación Argentina',
        logo: 'https://www.bna.com.ar/Content/img/logo-bna.png',
        tasas,
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}

/**
 * Extrae tasas de la tabla "PF TRAD.EN UVA CON PAGO INTERÉS SUBPERÍODOS DE 30 DÍAS"
 * embebida en el markdown de Defuddle (sin IA).
 */
export function parsearTasasUvaPagoPeriodicoDesdeMarkdown(markdown) {
  const tablaHtml = extraerTablaHtml(markdown, TITULO_TABLA)

  if (!tablaHtml) {
    return []
  }

  const $ = load(tablaHtml)
  const tasas = []

  $('tr').each((_, fila) => {
    const celdas = $(fila).find('td')

    if (celdas.length !== 3) {
      return
    }

    const rangoTexto = $(celdas[0]).text().trim()
    const plazos = parsearRangoPlazoDias(rangoTexto)

    if (!plazos) {
      return
    }

    const tna = parsearPorcentaje($(celdas[1]).text())
    const tea = parsearPorcentaje($(celdas[2]).text())

    if (tna === null || tea === null) {
      return
    }

    tasas.push({
      nombre: TITULO_TABLA,
      plazoMinDias: plazos.plazoMinDias,
      plazoMaxDias: plazos.plazoMaxDias,
      tna,
      tea,
    })
  })

  return tasas
}

function extraerTablaHtml(markdown, titulo) {
  if (!markdown) {
    return null
  }

  const tablas = markdown.match(/<table[\s\S]*?<\/table>/gi) || []

  return (
    tablas.find(tabla =>
      tabla.toUpperCase().includes(titulo.toUpperCase()),
    ) || null
  )
}

function parsearRangoPlazoDias(texto) {
  if (!texto) return null

  const coincidencia = texto.match(/De\s+(\d+)\s+a\s+(\d+)/i)

  if (!coincidencia) return null

  const plazoMinDias = Number.parseInt(coincidencia[1], 10)
  const plazoMaxDias = Number.parseInt(coincidencia[2], 10)

  if (Number.isNaN(plazoMinDias) || Number.isNaN(plazoMaxDias)) return null

  return {
    plazoMinDias,
    plazoMaxDias,
  }
}

function parsearPorcentaje(valor) {
  if (!valor) return null

  const limpio = valor.replace('%', '').replace(',', '.').trim()

  const numero = Number.parseFloat(limpio)

  return Number.isNaN(numero) ? null : numero / 100
}

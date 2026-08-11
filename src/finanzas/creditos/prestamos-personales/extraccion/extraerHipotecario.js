import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { parseFechaSlash, parsePorcentaje } from './parsePorcentaje.js'

const URL =
  'https://www.hipotecario.com.ar/personas/prestamos-personales/prestamo-con-destino-libre/'

const log = logGrupo({
  fuente: 'extraerHipotecarioPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * @param {string} htmlOrText
 * @returns {Array<object>}
 */
export function parsearHipotecario(htmlOrText) {
  const texto = String(htmlOrText).replace(/\s+/g, ' ')

  /** @type {Array<{ plazoMinMeses: number, plazoMaxMeses: number, tna: number, tea: number, cftTea: number, plazoMesesEjemplo: number }>} */
  const tramos = []

  const re =
    /Para un Pr[ée]stamo de\s+(\d+)\s+a\s+(\d+)\s+cuotas([\s\S]*?)(?=Para un Pr[ée]stamo de\s+\d+\s+a\s+\d+\s+cuotas|$)/gi

  let match
  while ((match = re.exec(texto)) !== null) {
    const plazoMinMeses = Number.parseInt(match[1], 10)
    const plazoMaxMeses = Number.parseInt(match[2], 10)
    const bloque = match[3]

    const tnaMatch = bloque.match(/TNA:\s*([\d.,]+)\s*%/i)
    const teaMatch =
      bloque.match(/TASA EFECTIVA ANUAL\s*([\d.,]+)\s*%/i) ||
      bloque.match(/\bTEA:\s*([\d.,]+)\s*%/i)
    const cftMatch =
      bloque.match(
        /COSTO FINANCIERO TOTAL\s*\(CFT\)\s*([\d.,]+)\s*%/i,
      ) ||
      bloque.match(/\(1\)\s*CFT:\s*([\d.,]+)\s*%/i) ||
      // CFT del encabezado anterior al bloque a veces queda fuera; buscar en ventana previa
      null

    // El CFT del título queda justo antes del "Para un Préstamo…"; tomarlo del contexto.
    const cftHeadMatch = texto
      .slice(Math.max(0, match.index - 80), match.index)
      .match(/CFT:\s*([\d.,]+)\s*%/i)

    const tna = tnaMatch ? parsePorcentaje(tnaMatch[1]) : null
    const tea = teaMatch ? parsePorcentaje(teaMatch[1]) : null
    const cftTea = cftMatch
      ? parsePorcentaje(cftMatch[1])
      : cftHeadMatch
        ? parsePorcentaje(cftHeadMatch[1])
        : null

    if (
      !plazoMinMeses ||
      !plazoMaxMeses ||
      tna === null ||
      tea === null ||
      cftTea === null
    ) {
      continue
    }

    const ejemploMatch = bloque.match(/PLAZO DE\s+(\d+)\s+MESES/i)
    const plazoMesesEjemplo = ejemploMatch
      ? Number.parseInt(ejemploMatch[1], 10)
      : plazoMaxMeses

    tramos.push({
      plazoMinMeses,
      plazoMaxMeses,
      tna,
      tea,
      cftTea,
      plazoMesesEjemplo,
    })
  }

  if (!tramos.length) return []

  tramos.sort((a, b) => a.plazoMinMeses - b.plazoMinMeses)

  const vigenciaMatch = texto.match(
    /OFERTA V[AÁ]LIDA DESDE(?: EL)?\s+(\d{1,2}\/\d{1,2}\/\d{4})\s*al\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
  )
  const vigenciaDesde = vigenciaMatch
    ? parseFechaSlash(vigenciaMatch[1])
    : null
  const vigenciaHasta = vigenciaMatch
    ? parseFechaSlash(vigenciaMatch[2])
    : null

  const tasasPorPlazo = tramos.map(
    ({ plazoMinMeses, plazoMaxMeses, tna, tea, cftTea }) => ({
      plazoMinMeses,
      plazoMaxMeses,
      tna,
      tea,
      cftTea,
    }),
  )

  const plazoMinMeses = tasasPorPlazo[0].plazoMinMeses
  const plazoMaxMeses = tasasPorPlazo[tasasPorPlazo.length - 1].plazoMaxMeses
  const ref = tramos[tramos.length - 1]
  const plazoMesesEjemplo =
    tramos.find((t) => t.plazoMesesEjemplo === 12)?.plazoMesesEjemplo ||
    ref.plazoMesesEjemplo

  return [
    {
      entidad: 'HIPOTECARIO',
      nombreComercial: 'Banco Hipotecario',
      producto: 'Préstamo con destino libre',
      tna: ref.tna,
      tea: ref.tea,
      cftTna: null,
      cftTea: ref.cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: false,
      condiciones: 'Cartera general / Cartera de consumo',
      enlace: URL,
      vigenciaDesde,
      vigenciaHasta,
      metadata: {
        plazoMesesEjemplo,
        plazoMinMeses,
        plazoMaxMeses,
        tasasPorPlazo,
      },
    },
  ]
}

async function fetchHtml() {
  const respuesta = await axios.get(URL, {
    responseType: 'text',
    timeout: 20000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  })

  return String(respuesta.data)
}

export async function extraerHipotecario() {
  try {
    const html = await fetchHtml()
    const ofertas = parsearHipotecario(html)

    logMensaje(log, 'Hipotecario parseado', {
      ofertas: ofertas.length,
      tramos: ofertas[0]?.metadata?.tasasPorPlazo?.length,
    })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}

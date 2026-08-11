import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { parseFechaSlash, parsePorcentaje } from './parsePorcentaje.js'

const URL = 'https://www.bancopatagonia.com.ar/landings/prestamos-online.php'

const log = logGrupo({
  fuente: 'extraerPatagoniaPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * @param {string} htmlOrText
 * @returns {Array<object>}
 */
export function parsearPatagonia(htmlOrText) {
  const texto = String(htmlOrText).replace(/\s+/g, ' ')

  const tnaMatch =
    texto.match(/TASA NOMINAL ANUAL\s*:\s*([\d.,]+)\s*%/i) ||
    texto.match(/\bTNA\s*:\s*([\d.,]+)\s*%/i)

  const teaMatch =
    texto.match(/TASA EFECTIVA ANUAL\s*:\s*([\d.,]+)\s*%/i) ||
    texto.match(/\bTEA\s*:\s*([\d.,]+)\s*%/i)

  const cftMatch =
    texto.match(
      /CFTEA\s*:\s*[\d.,]+\s*%\s*\(sin IVA\)\s*[–\-—]\s*([\d.,]+)\s*%\s*\(con IVA\)/i,
    ) ||
    texto.match(/CFTEA[^0-9%]{0,40}([\d.,]+)\s*%\s*\(con IVA\)/i)

  const tna = tnaMatch ? parsePorcentaje(tnaMatch[1]) : null
  const tea = teaMatch ? parsePorcentaje(teaMatch[1]) : null
  const cftTea = cftMatch ? parsePorcentaje(cftMatch[1]) : null

  if (tna === null && cftTea === null) {
    return []
  }

  const plazoMaxMatch =
    texto.match(
      /PLAZO M[AÁ]XIMO DE FINANCIACI[OÓ]N\s*:\s*HASTA\s+(\d+)/i,
    ) ||
    texto.match(/hasta\s+(\d+)\s+meses/i)

  const plazoMaxMeses = plazoMaxMatch
    ? Number.parseInt(plazoMaxMatch[1], 10)
    : 60
  const plazoMinMeses = 1

  const vigenciaMatch = texto.match(
    /PROMOCI[OÓ]N V[AÁ]LIDA DEL\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+AL\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
  )
  const vigenciaDesde = vigenciaMatch
    ? parseFechaSlash(vigenciaMatch[1])
    : null
  const vigenciaHasta = vigenciaMatch
    ? parseFechaSlash(vigenciaMatch[2])
    : null

  const tasasPorPlazo = [
    {
      plazoMinMeses,
      plazoMaxMeses,
      tna,
      tea,
      cftTea,
    },
  ]

  return [
    {
      entidad: 'PATAGONIA',
      nombreComercial: 'Banco Patagonia',
      producto: 'Préstamo personal online',
      tna,
      tea,
      cftTna: null,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: true,
      condiciones: 'Cartera de consumo',
      enlace: URL,
      vigenciaDesde,
      vigenciaHasta,
      metadata: {
        plazoMesesEjemplo: plazoMaxMeses,
        plazoMinMeses,
        plazoMaxMeses,
        tasasPorPlazo,
      },
    },
  ]
}

export async function extraerPatagonia() {
  try {
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

    const ofertas = parsearPatagonia(String(respuesta.data))

    logMensaje(log, 'Patagonia parseado', {
      ofertas: ofertas.length,
      tramos: ofertas[0]?.metadata?.tasasPorPlazo?.length,
    })

    return ofertas
  } catch (error) {
    logError(log, error)
    return []
  }
}

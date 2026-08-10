import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError } from '@/log.js'
import { parseFechaTextoEs, parsePorcentaje } from './parsePorcentaje.js'

const URL =
  'https://www.bbva.com.ar/personas/productos/prestamos/personales.html'

const log = logGrupo({
  fuente: 'extraerBbvaPrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearBbva(html) {
  const $ = load(html)

  const cftTeaTexto = $('span.cft_pesos').first().text()
  const cftTeaMatch = cftTeaTexto.match(/CFTEA:\s*([\d.,]+)\s*%/i)
  const cftTea = cftTeaMatch ? parsePorcentaje(cftTeaMatch[1]) : null

  const disclaimer = $('h4.disclaimer__title').first().text()
  const tnaMatch = disclaimer.match(
    /Tasa Nominal Anual:\s*([\d.,]+)\s*%/i,
  )
  const teaMatch = disclaimer.match(
    /Tasa Efectiva Anual:\s*([\d.,]+)\s*%/i,
  )

  const tna = tnaMatch ? parsePorcentaje(tnaMatch[1]) : null
  const tea = teaMatch ? parsePorcentaje(teaMatch[1]) : null

  if (tna === null && cftTea === null) {
    return []
  }

  const legal = $.root().text().replace(/\s+/g, ' ')

  const vigenciaMatch = legal.match(
    /V[ÁA]LIDA DEL\s+(\d{1,2}\s+DE\s+[A-ZÁÉÍÓÚÑ]+\s+DE\s+\d{4})\s+HASTA EL\s+(\d{1,2}\s+DE\s+[A-ZÁÉÍÓÚÑ]+\s+DE\s+\d{4})/i,
  )

  const requiereCliente = /EXCLUSIVA PARA CLIENTES BBVA/i.test(legal)

  return [
    {
      entidad: 'BBVA',
      nombreComercial: 'BBVA',
      producto: 'Préstamo personal',
      tna,
      tea,
      cftTna: null,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente,
      condiciones: requiereCliente
        ? 'Oferta exclusiva para clientes BBVA'
        : null,
      enlace: URL,
      vigenciaDesde: vigenciaMatch
        ? parseFechaTextoEs(vigenciaMatch[1])
        : null,
      vigenciaHasta: vigenciaMatch
        ? parseFechaTextoEs(vigenciaMatch[2])
        : null,
      metadata: {},
    },
  ]
}

export async function extraerBbva() {
  try {
    const respuesta = await axios.get(URL, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      },
    })

    return parsearBbva(respuesta.data)
  } catch (error) {
    logError(log, error)
    return []
  }
}

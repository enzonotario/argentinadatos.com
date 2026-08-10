import axios from 'axios'
import { logGrupo, logError } from '@/log.js'
import { parseFechaSlash, parsePorcentaje } from './parsePorcentaje.js'

const URL =
  'https://www.supervielle.com.ar/personas/prestamos/personales'

const log = logGrupo({
  fuente: 'extraerSuperviellePrestamosPersonales',
  tipo: 'extraccion',
})

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearSupervielle(html) {
  const texto = String(html).replace(/\s+/g, ' ')

  // Ej.: Para un préstamo personal de $1.000.000 en 36 cuotas de $146.311,35:
  // Tasa Nominal Anual Fija 145,00%, Tasa Efectiva Anual Fija 293,50%,
  // Costo Financiero Total Efectivo Anual con IVA 414,99%
  // Costo Financiero Total Efectivo sin IVA 293,50%
  const tasasMatch = texto.match(
    /pr[ée]stamo personal de\s*\$\s*[\d.]+\s+en\s+\d+\s*cuotas[^:]*:\s*Tasa Nominal Anual Fija\s*([\d.,]+)\s*%\s*,\s*Tasa Efectiva Anual Fija\s*([\d.,]+)\s*%\s*,\s*Costo Financiero Total Efectivo Anual con IVA\s*([\d.,]+)\s*%\s*Costo Financiero Total Efectivo sin IVA\s*([\d.,]+)\s*%/i,
  )

  if (!tasasMatch) {
    return []
  }

  const tna = parsePorcentaje(tasasMatch[1])
  const tea = parsePorcentaje(tasasMatch[2])
  const cftTea = parsePorcentaje(tasasMatch[3])
  const cftTeaSinIva = parsePorcentaje(tasasMatch[4])

  const vigenciaMatch = texto.match(
    /Vigencia del\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s*al\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
  )

  return [
    {
      entidad: 'SUPERVIELLE',
      nombreComercial: 'Supervielle',
      producto: 'Préstamo personal',
      tna,
      tea,
      cftTna: null,
      cftTea,
      tipoTasa: 'fija',
      moneda: 'ARS',
      requiereCliente: false,
      condiciones: 'Cartera consumo',
      enlace: URL,
      vigenciaDesde: vigenciaMatch
        ? parseFechaSlash(vigenciaMatch[1])
        : null,
      vigenciaHasta: vigenciaMatch
        ? parseFechaSlash(vigenciaMatch[2])
        : null,
      metadata: {
        ...(cftTeaSinIva !== null
          ? { cftTeaSinIva }
          : {}),
      },
    },
  ]
}

export async function extraerSupervielle() {
  try {
    const respuesta = await axios.get(URL, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ArgentinaDatos/1.0; +https://argentinadatos.com)',
      },
    })

    return parsearSupervielle(respuesta.data)
  } catch (error) {
    logError(log, error)
    return []
  }
}

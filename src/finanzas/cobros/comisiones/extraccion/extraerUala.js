import axios from 'axios'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionCobro,
  parseArancelTexto,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'

export const UALA_BIS_QR_URL = 'https://www.ualabis.com.ar/qr'
export const UALA_BIS_LECTORES_URL = 'https://www.ualabis.com.ar/lectores'

const log = logGrupo({
  fuente: 'extraerUalaComisionesCobro',
  tipo: 'extraccion',
})

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearUalaBisQr(html) {
  const texto = String(html).replace(/\s+/g, ' ')

  const match = texto.match(
    /comisi[oó]n es de\s+([\d.,]+)\s*%\s+para dinero en cuenta,\s*([\d.,]+)\s*%\s*d[eé]bito\s*y\s*([\d.,]+)\s*%\s*cr[eé]dito y prepagas/i,
  )

  if (!match) {
    return []
  }

  const cuenta = parseArancelTexto(`${match[1]}% + IVA`)
  const debito = parseArancelTexto(`${match[2]}% + IVA`)
  const credito = parseArancelTexto(`${match[3]}% + IVA`)

  const base = {
    entidad: 'uala',
    nombreComercial: 'Ualá Bis',
    canal: 'qr',
    incluyeIva: false,
    ivaAdicional: true,
    acreditacionTipo: 'inmediata',
    acreditacionPlazoHabiles: 0,
    acreditacionLabel: 'Inmediata',
    enlace: UALA_BIS_QR_URL,
    metadata: {
      fuenteUrl: UALA_BIS_QR_URL,
    },
  }

  return [
    crearComisionCobro({
      ...base,
      producto: 'QR dinero en cuenta',
      medioPago: 'qr_cuenta',
      arancel: cuenta.arancel,
      arancelEsTope: false,
      condiciones:
        '0% los primeros 3 meses para pagos con saldo en cuenta (BCRA); luego aplica el arancel informado.',
    }),
    crearComisionCobro({
      ...base,
      producto: 'QR débito',
      medioPago: 'debito',
      arancel: debito.arancel,
      arancelEsTope: false,
      condiciones: null,
    }),
    crearComisionCobro({
      ...base,
      producto: 'QR crédito y prepagas',
      medioPago: 'credito',
      arancel: credito.arancel,
      arancelEsTope: false,
      condiciones: 'Mismo arancel para prepagas.',
      metadata: {
        ...base.metadata,
        tambienAplicaA: ['prepaga'],
      },
    }),
  ]
}

/**
 * @param {string} html
 * @returns {Array<object>}
 */
export function parsearUalaBisLectores(html) {
  const texto = String(html).replace(/\s+/g, ' ')

  const match = texto.match(
    /([\d.,]+)\s*%\s*\+?\s*IVA\s+en\s+Cr[eé]dito y Prepagas\.?\s*\|\s*([\d.,]+)\s*%\s*\+?\s*IVA\s+en\s+D[eé]bito/i,
  )

  if (!match) {
    return []
  }

  const credito = parseArancelTexto(`${match[1]}% + IVA`)
  const debito = parseArancelTexto(`${match[2]}% + IVA`)

  const base = {
    entidad: 'uala',
    nombreComercial: 'Ualá Bis',
    canal: 'pos',
    incluyeIva: false,
    ivaAdicional: true,
    acreditacionTipo: 'inmediata',
    acreditacionPlazoHabiles: 0,
    acreditacionLabel: 'Inmediata',
    enlace: UALA_BIS_LECTORES_URL,
    metadata: {
      fuenteUrl: UALA_BIS_LECTORES_URL,
    },
  }

  return [
    crearComisionCobro({
      ...base,
      producto: 'POS débito',
      medioPago: 'debito',
      arancel: debito.arancel,
      arancelEsTope: false,
      condiciones: 'Aplica a POS Pro y POS Mini.',
    }),
    crearComisionCobro({
      ...base,
      producto: 'POS crédito y prepagas',
      medioPago: 'credito',
      arancel: credito.arancel,
      arancelEsTope: false,
      condiciones: 'Aplica a POS Pro y POS Mini; mismo arancel para prepagas.',
      metadata: {
        ...base.metadata,
        tambienAplicaA: ['prepaga'],
      },
    }),
  ]
}

/**
 * @param {{ qrHtml?: string, lectoresHtml?: string }} htmls
 * @returns {Array<object>}
 */
export function parsearUalaBis(htmls) {
  return [
    ...parsearUalaBisQr(htmls.qrHtml || ''),
    ...parsearUalaBisLectores(htmls.lectoresHtml || ''),
  ]
}

async function fetchHtml(url) {
  const respuesta = await axios.get(url, {
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

export async function extraerUala() {
  try {
    const [qrHtml, lectoresHtml] = await Promise.all([
      fetchHtml(UALA_BIS_QR_URL),
      fetchHtml(UALA_BIS_LECTORES_URL),
    ])

    const comisiones = parsearUalaBis({ qrHtml, lectoresHtml })

    logMensaje(log, 'Ualá Bis parseado', { filas: comisiones.length })

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}

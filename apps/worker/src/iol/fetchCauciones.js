import axios from 'axios'
import { IOL_BROWSER_HEADERS } from './auth.js'

const CAUCIONES_URL =
  'https://api.invertironline.com/api/v2/Cotizaciones/cauciones/todas/argentina'

/**
 * @param {string} accessToken
 * @returns {Promise<{ titulos: Array<{ plazo: number, montoContado: number, tasaPromedio: number, fechaVencimiento: string }> }>}
 */
export async function fetchCauciones(accessToken) {
  const { data } = await axios.get(CAUCIONES_URL, {
    headers: {
      ...IOL_BROWSER_HEADERS,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    timeout: 30_000,
  })

  const titulos = Array.isArray(data?.titulos) ? data.titulos : []
  return { titulos }
}

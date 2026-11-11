import { logGrupo, logMensaje } from '@/log.js'
import { crearAlternativaFal } from './crearAlternativaFal.js'
import { fetchTextoFal } from './fetchTextoFal.js'

export const ADCAP_FAL_URL = 'https://asset.ad-cap.com.ar/fal'

const log = logGrupo({
  fuente: 'extraerAdcapFal',
  tipo: 'extraccion',
})

/**
 * @param {string} texto
 */
export function parsearAdcapFal(texto) {
  const t = String(texto)
  const gerente = t.match(
    /Adcap Asset Management Sociedad Gerente de Fondos Comunes de Inversi[oó]n S\.A\./,
  )
  const esAdcap =
    /Adcap Asset Management/i.test(t) &&
    /Fondo de Asistencia Laboral|\bFAL\b/i.test(t) &&
    /veh[ií]culo FAL/i.test(t) &&
    /Fondos Comunes de Inversi[oó]n/i.test(t)

  if (!esAdcap) return []

  return [
    crearAlternativaFal({
      entidad: 'adcap',
      nombreComercial: 'Adcap',
      vehiculo: 'fci_abierto',
      sociedadGerente: gerente?.[0] ?? 'Adcap Asset Management',
      canal: /Gestion[aá] tu ID/i.test(t) ? 'web' : null,
      vigenciaDeclarada: /1\s*[º°]?\s*de diciembre de 2026/i.test(t)
        ? '2026-12-01'
        : null,
      enlace: ADCAP_FAL_URL,
      condiciones:
        'Estructura vehículos FAL a medida. La página no publica la comisión ni el nombre de un fondo FAL concreto.',
      metadata: {
        fuenteUrl: ADCAP_FAL_URL,
      },
    }),
  ]
}

export async function extraerAdcapFal() {
  const texto = await fetchTextoFal(ADCAP_FAL_URL, log)
  const filas = parsearAdcapFal(texto)

  logMensaje(log, 'Adcap FAL parseado', { filas: filas.length })

  return filas
}

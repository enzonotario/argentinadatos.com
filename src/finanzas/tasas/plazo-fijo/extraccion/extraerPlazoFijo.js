import axios from 'axios'
import { extraerUalaPlazoFijo } from '@/finanzas/tasas/plazo-fijo/extraccion/extraerUala.js'
import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerPlazoFijo',
  tipo: 'extraccion',
})

const URL_PLAZOS_FIJOS_BCRA =
  'https://www.bcra.gob.ar/api/endpoints/plazos-fijos.php'

export async function extraerPlazoFijo() {
  try {
    return [...(await obtenerRespuesta()), await extraerUalaPlazoFijo()]
  } catch (error) {
    logError(log, error)
    return []
  }
}

export async function obtenerRespuesta() {
  try {
    const respuesta = await axios.get(URL_PLAZOS_FIJOS_BCRA)
    const datos = respuesta.data

    if (!datos || !datos.success) {
      logError(
        log,
        new Error('Respuesta inválida de plazos fijos BCRA (success o datos)'),
      )
      return []
    }

    return [...(datos.top10 || []), ...(datos.otros || [])].map(item => ({
      entidad: item.entidad.trim(),
      logo: item.logo_url,
      tnaClientes: porcentajeADecimal(item.tasa_con_relacion),
      tnaNoClientes: porcentajeADecimal(item.tasa_sin_relacion),
      enlace: item.web || null,
    }))
  } catch (error) {
    logError(log, error)
    return []
  }
}

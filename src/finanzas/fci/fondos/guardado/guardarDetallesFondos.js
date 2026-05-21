import { escribirRuta } from '@/utils/rutas.js'
import { logError, logGrupo, logMensaje } from '@/log.js'
import {
  normalizarNombreFondo,
  omitirMetadataInterna,
} from '@/finanzas/fci/fondos/utils/normalizarNombreFondo.js'

export function guardarDetalleFondo(fondo) {
  const slug = normalizarNombreFondo(fondo)
  escribirRuta(`/finanzas/fci/fondos/${slug}`, omitirMetadataInterna(fondo))
  return slug
}

export async function guardarListaFondos(datos) {
  const log = logGrupo({
    fuente: 'guardarListaFondos',
    tipo: 'fciFondos',
  })

  try {
    const payload = {
      ...datos,
      fondos: (datos?.fondos || []).map(omitirMetadataInterna),
    }

    escribirRuta('/finanzas/fci/fondos', payload)

    logMensaje(log, 'Lista de fondos guardada', {
      cantidad: payload.fondos.length,
    })

    return true
  } catch (error) {
    logError(log, error)
    return false
  }
}

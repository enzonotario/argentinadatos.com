import { escribirRuta } from '@/utils/rutas.js'
import { logError, logGrupo, logMensaje } from '@/log.js'
import {
  clavesSlugFondo,
  omitirMetadataInterna,
} from '@/finanzas/fci/fondos/utils/normalizarNombreFondo.js'

export function guardarDetalleFondo(fondo) {
  const slugs = clavesSlugFondo(fondo)
  const publico = omitirMetadataInterna(fondo)

  for (const slug of slugs) {
    escribirRuta(`/finanzas/fci/fondos/${slug}`, publico)
  }

  return slugs[0]
}

export function guardarHistoricoFondo(fondo, historico, fechaActualizacion) {
  const slugs = clavesSlugFondo(fondo)
  const payload = {
    fondoId: fondo.fondoId,
    claseId: fondo.claseId,
    nombre: fondo.nombre,
    fechaActualizacion,
    historico,
  }

  for (const slug of slugs) {
    escribirRuta(`/finanzas/fci/fondos/${slug}/historico`, payload)
  }

  return slugs[0]
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

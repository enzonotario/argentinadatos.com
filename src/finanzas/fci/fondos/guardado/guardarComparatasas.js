import { escribirRuta } from '@/utils/rutas.js'
import { logError, logGrupo, logMensaje } from '@/log.js'
import { omitirMetadataInterna } from '@/finanzas/fci/fondos/utils/normalizarNombreFondo.js'
import { comparatasasFondos } from '@/finanzas/fci/fondos/comparatasas-fondos.js'

export async function guardarComparatasas({ fondos, fechaActualizacion }) {
  const log = logGrupo({
    fuente: 'guardarComparatasas',
    tipo: 'fciFondos',
  })

  try {
    const fondosPorSlug = Object.fromEntries(
      fondos.map((fondo) => [fondo.slug, fondo]),
    )

    const slugsSet = new Set(comparatasasFondos)

    const fondosComparatasas = comparatasasFondos
      .map((slug) => {
        const fondo = fondosPorSlug[slug]
        return fondo ? omitirMetadataInterna(fondo) : null
      })
      .filter(Boolean)

    const payload = {
      fechaActualizacion,
      fondos: fondosComparatasas,
    }

    escribirRuta('/finanzas/fci/comparatasas', payload)

    logMensaje(log, 'Fondos comparatasas guardados', {
      cantidad: fondosComparatasas.length,
      noEncontrados: slugsSet.size - fondosComparatasas.length,
    })

    return true
  } catch (error) {
    logError(log, error)
    return false
  }
}

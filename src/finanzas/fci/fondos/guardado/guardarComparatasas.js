import { escribirRuta } from '@/utils/rutas.js'
import { logError, logGrupo, logMensaje } from '@/log.js'
import {
  clavesSlugFondo,
  omitirMetadataInterna,
} from '@/finanzas/fci/fondos/utils/normalizarNombreFondo.js'
import { comparatasasFondos } from '@/finanzas/fci/fondos/comparatasas-fondos.js'

export function indexarFondosPorSlug(fondos) {
  const fondosPorSlug = new Map()

  for (const fondo of fondos) {
    for (const clave of clavesSlugFondo(fondo)) {
      if (!fondosPorSlug.has(clave)) {
        fondosPorSlug.set(clave, fondo)
      }
    }
  }

  return fondosPorSlug
}

export function seleccionarFondosComparatasas(
  fondos,
  slugs = comparatasasFondos,
) {
  const fondosPorSlug = indexarFondosPorSlug(fondos)
  const encontrados = []
  const noEncontrados = []
  const usados = new Set()

  for (const slug of slugs) {
    const fondo = fondosPorSlug.get(slug)
    if (!fondo) {
      noEncontrados.push(slug)
      continue
    }

    const key = `${fondo.fondoId}:${fondo.claseId}`
    if (usados.has(key)) {
      continue
    }

    usados.add(key)
    encontrados.push(omitirMetadataInterna(fondo))
  }

  return { encontrados, noEncontrados }
}

export async function guardarComparatasas({ fondos, fechaActualizacion }) {
  const log = logGrupo({
    fuente: 'guardarComparatasas',
    tipo: 'fciFondos',
  })

  try {
    const { encontrados, noEncontrados } = seleccionarFondosComparatasas(fondos)

    escribirRuta('/finanzas/fci/comparatasas', {
      fechaActualizacion,
      fondos: encontrados,
    })

    logMensaje(log, 'Fondos comparatasas guardados', {
      cantidad: encontrados.length,
      noEncontrados: noEncontrados.length,
      slugsNoEncontrados: noEncontrados,
    })

    return true
  } catch (error) {
    logError(log, error)
    return false
  }
}

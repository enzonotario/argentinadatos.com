import { logMensaje } from '@/log.js'
import { redondearCalificacion } from '@/finanzas/remesas/extraccion/stores/playStore.js'

export function buildItunesLookupUrl(appStoreId, { country = 'ar' } = {}) {
  const params = new URLSearchParams({ id: String(appStoreId), country })
  return `https://itunes.apple.com/lookup?${params.toString()}`
}

export function parsearCalificacionItunesLookup(payload) {
  const resultado = payload?.results?.[0]
  const rating =
    resultado?.averageUserRating ??
    resultado?.averageUserRatingForCurrentVersion

  return redondearCalificacion(Number(rating))
}

export function parsearAppStoreIdDesdeUrl(url) {
  if (!url) return null

  const match = String(url).match(/\/id(\d+)/i)
  return match?.[1] ?? null
}

export async function obtenerCalificacionAppStore(
  log,
  { nombre, appStoreId, url, country = 'ar' },
) {
  const id = appStoreId || parsearAppStoreIdDesdeUrl(url)

  if (!id) {
    throw new Error(`App Store ${nombre}: falta appStoreId o url con /id`)
  }

  const lookupUrl = buildItunesLookupUrl(id, { country })

  logMensaje(log, 'iTunes Lookup: extrayendo calificación', {
    nombre,
    url: lookupUrl,
  })

  const respuesta = await fetch(lookupUrl)

  if (!respuesta.ok) {
    throw new Error(
      `iTunes Lookup ${nombre}: ${respuesta.status} ${respuesta.statusText}`,
    )
  }

  const payload = await respuesta.json()
  const calificacion = parsearCalificacionItunesLookup(payload)

  if (calificacion == null) {
    throw new Error(`iTunes Lookup ${nombre}: sin averageUserRating`)
  }

  return calificacion
}

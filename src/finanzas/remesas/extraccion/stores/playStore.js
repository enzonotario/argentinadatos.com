import { logMensaje } from '@/log.js'

const PLAY_STORE_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export function redondearCalificacion(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    return null
  }

  return Math.round(valor * 100) / 100
}

export function parsearCalificacionPlayStore(html) {
  if (!html) return null

  const aria = html.match(
    /aria-label="Calificación:\s*([0-9]+(?:[.,][0-9]+)?)\s*de cinco estrellas"/i,
  )

  if (aria?.[1]) {
    return redondearCalificacion(Number(aria[1].replace(',', '.')))
  }

  const ratingValue = html.match(
    /"ratingValue"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/,
  )

  if (ratingValue?.[1]) {
    return redondearCalificacion(Number(ratingValue[1]))
  }

  return null
}

export function buildPlayStoreUrl(packageId, { hl = 'es_AR', gl = 'AR' } = {}) {
  const params = new URLSearchParams({ id: packageId, hl, gl })
  return `https://play.google.com/store/apps/details?${params.toString()}`
}

export async function obtenerCalificacionPlayStore(
  log,
  { nombre, url, packageId },
) {
  const playStoreUrl = url || (packageId ? buildPlayStoreUrl(packageId) : null)

  if (!playStoreUrl) {
    throw new Error(`Play Store ${nombre}: falta url o packageId`)
  }

  logMensaje(log, 'Play Store: extrayendo calificación', {
    nombre,
    url: playStoreUrl,
  })

  const respuesta = await fetch(playStoreUrl, {
    headers: {
      'User-Agent': PLAY_STORE_USER_AGENT,
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  })

  if (!respuesta.ok) {
    throw new Error(
      `Play Store ${nombre}: ${respuesta.status} ${respuesta.statusText}`,
    )
  }

  const html = await respuesta.text()
  const calificacion = parsearCalificacionPlayStore(html)

  if (calificacion == null) {
    throw new Error(`Play Store ${nombre}: no se encontró ratingValue`)
  }

  return calificacion
}

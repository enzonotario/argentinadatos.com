import { logMensaje } from '@/log.js'
import { fuenteGrabrfiRemesas } from '@/finanzas/remesas/extraccion/extraerGrabrfiRemesas.js'
import { fuenteLbFinanzasRemesas } from '@/finanzas/remesas/extraccion/extraerLbFinanzasRemesas.js'
import { fuentePayoneerRemesas } from '@/finanzas/remesas/extraccion/extraerPayoneerRemesas.js'
import { fuenteTakenosRemesas } from '@/finanzas/remesas/extraccion/extraerTakenosRemesas.js'
import { fuenteWallbitRemesas } from '@/finanzas/remesas/extraccion/extraerWallbitRemesas.js'
import { fuenteWiseRemesas } from '@/finanzas/remesas/extraccion/extraerWiseRemesas.js'

/**
 * Proveedores que siguen en Dolarito: AirTM.
 */
export const FUENTES_REMESAS_DIRECTAS = [
  fuenteWallbitRemesas,
  fuenteTakenosRemesas,
  fuenteGrabrfiRemesas,
  fuenteWiseRemesas,
  fuentePayoneerRemesas,
  fuenteLbFinanzasRemesas,
]

export function htmlATexto(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\u0441/g, 'c')
    .replace(/\s+/g, ' ')
    .trim()
}

async function obtenerTexto(url) {
  const respuesta = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; ArgentinaDatos/1.0)',
      accept: 'text/html',
    },
  })

  if (!respuesta.ok) {
    throw new Error(
      `Error al obtener ${url}: ${respuesta.status} ${respuesta.statusText}`,
    )
  }

  return htmlATexto(await respuesta.text())
}

async function extraerFuente(log, fuente) {
  logMensaje(log, `Fuente oficial: ${fuente.nombre}`, { url: fuente.url })

  const texto = await obtenerTexto(fuente.url)
  const remesa = fuente.mapear(texto)

  if (remesa.compania?.toLowerCase() !== fuente.nombre) {
    throw new Error(`Parser de ${fuente.nombre} devolvió ${remesa.compania}`)
  }

  return remesa
}

export async function extraerFuentesDirectasRemesas(log) {
  return Promise.all(
    FUENTES_REMESAS_DIRECTAS.map(async fuente => {
      try {
        return { ok: true, remesa: await extraerFuente(log, fuente) }
      } catch (error) {
        logMensaje(
          log,
          `extraerRemesas: falló fuente oficial ${fuente.nombre}`,
          {
            url: fuente.url,
            errorMessage: error?.message,
          },
        )

        return { ok: false, nombre: fuente.nombre, error }
      }
    }),
  )
}

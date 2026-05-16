import { extraerCotizaciones } from '@/cotizaciones/extraccion/extraerCotizaciones.js'
import { guardarCotizaciones } from '@/cotizaciones/guardado/guardarCotizaciones.js'
import { extraerDolares } from '@/cotizaciones/extraccion/extraerDolares.js'
import { guardarDolares } from '@/cotizaciones/guardado/guardarDolares.js'

export async function cronCotizaciones() {
  const cotizaciones = await extraerCotizaciones()

  await guardarCotizaciones(cotizaciones, new Date())

  const dolares = await extraerDolares()

  await guardarDolares(dolares, new Date())

  return true
}

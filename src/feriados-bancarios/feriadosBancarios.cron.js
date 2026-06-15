import { extraerFeriadosBancarios } from '@/feriados-bancarios/extraccion/extraerFeriadosBancarios.js'
import { guardarFeriadosBancarios } from '@/feriados-bancarios/guardado/guardarFeriadosBancarios.js'
import { escribirRuta } from '@/utils/rutas.js'

export async function cronFeriadosBancarios() {
  const hoy = new Date()

  for (let i = 0; i <= 5; i++) {
    const año = hoy.getFullYear() + i
    const feriados = await extraerFeriadosBancarios(año)

    if (!feriados || !feriados.length) {
      console.log(`No se encontraron feriados bancarios para el año ${año}`)
      continue
    }

    await guardarFeriadosBancarios(año, feriados)

    if (hoy.getFullYear() === año) {
      await escribirRuta(
        `/feriados-bancarios`,
        feriados.map(feriado => ({
          fecha: feriado.fecha,
          nombre: feriado.nombre,
        })),
      )
    }
  }

  return true
}

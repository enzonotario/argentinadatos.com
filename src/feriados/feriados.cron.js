import { extraerFeriados } from '@/feriados/extraccion/extraerFeriados.js'
import { guardarFeriados } from '@/feriados/guardado/guardarFeriados.js'
import { escribirRuta } from '@/utils/rutas.js'

export async function cronFeriados() {
  const hoy = new Date()

  for (let i = 0; i <= 5; i++) {
    const año = hoy.getFullYear() + i
    const feriados = await extraerFeriados(año)

    if (!feriados || !feriados.length) {
      console.log(`No se encontraron feriados para el año ${año}`)
      continue
    }

    const guardado = await guardarFeriados(año, feriados)

    if (hoy.getFullYear() === año) {
      await escribirRuta(
        `/feriados`,
        feriados.map(feriado => ({
          fecha: feriado.fecha,
          tipo: feriado.tipo,
          nombre: feriado.nombre,
        })),
      )
    }
  }

  return true
}

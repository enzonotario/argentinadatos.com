import { escribirRuta } from '@/utils/rutas.js'

export function guardarFeriadosBancarios(año, feriados) {
  return escribirRuta(
    `/feriados-bancarios/${año}`,
    feriados.map(feriado => ({
      fecha: feriado.fecha,
      nombre: feriado.nombre,
    })),
  )
}

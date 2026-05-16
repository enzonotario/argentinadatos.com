import { escribirRuta } from '@/utils/rutas.js'

export function guardarFeriados(año, feriados) {
  return escribirRuta(
    `/feriados/${año}`,
    feriados.map(feriado => ({
      fecha: feriado.fecha,
      tipo: feriado.tipo,
      nombre: feriado.nombre,
    })),
  )
}

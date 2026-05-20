import { ordenarPorFecha } from '@/utils/data.js'
import { leerRuta, escribirRuta } from '@/utils/rutas.js'

export async function guardarSerieCronologicaSinDuplicados(
  ruta,
  items,
  clave = 'fecha',
) {
  const actual = await leerRuta(ruta)
  const existentes = new Set(actual.map(item => item[clave]))

  for (const item of items) {
    if (!existentes.has(item[clave])) {
      actual.push(item)
      existentes.add(item[clave])
    }
  }

  return escribirRuta(ruta, ordenarPorFecha(actual))
}

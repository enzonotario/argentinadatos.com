import { escribirRuta } from '@/utils/rutas.js'
import { format } from 'date-fns'

export async function guardarCafci(serie, items, fecha) {
  const fechaConBarra = format(fecha, 'yyyy/MM/dd')

  return escribirRuta(`/finanzas/fci/${serie}/${fechaConBarra}`, items)
}

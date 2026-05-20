import { guardarSerieCronologicaSinDuplicados } from '@/finanzas/compartido/guardado/guardarSerieCronologica.js'

export async function guardarInflaciones(items) {
  return guardarSerieCronologicaSinDuplicados(
    '/finanzas/indices/inflacion',
    items,
  )
}

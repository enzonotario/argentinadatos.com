import { guardarSerieCronologicaSinDuplicados } from '@/finanzas/compartido/guardado/guardarSerieCronologica.js'

export async function guardarInflacionesInteranual(items) {
  return guardarSerieCronologicaSinDuplicados(
    '/finanzas/indices/inflacionInteranual',
    items,
  )
}

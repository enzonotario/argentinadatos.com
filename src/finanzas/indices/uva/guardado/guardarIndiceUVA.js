import { guardarSerieCronologicaSinDuplicados } from '@/finanzas/compartido/guardado/guardarSerieCronologica.js'

export async function guardarIndiceUVA(items) {
  return guardarSerieCronologicaSinDuplicados('/finanzas/indices/uva', items)
}

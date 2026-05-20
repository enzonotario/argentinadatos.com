import { guardarSerieCronologicaSinDuplicados } from '@/finanzas/compartido/guardado/guardarSerieCronologica.js'

export async function guardarTasasDepositos30Dias(items) {
  return guardarSerieCronologicaSinDuplicados(
    '/finanzas/tasas/depositos30Dias',
    items,
  )
}

import { CAUCIONES_COLLECTION } from '../schema/cauciones.js'

/** Crea la colección cauciones con el schema objetivo. */
export const id = '002_cauciones'

/**
 * Crea la colección cauciones.
 * Pensada para correr tras `migrate:fresh` (colección inexistente).
 */
export async function up(pb) {
  await pb.createCollection(CAUCIONES_COLLECTION)
  console.log('[migrate] 002_cauciones created collection')
}

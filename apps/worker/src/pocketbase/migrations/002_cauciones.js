import { CAUCIONES_COLLECTION } from '../schema/cauciones.js'

/** Crea la colección cauciones con el schema objetivo. */
export const id = '002_cauciones'

/**
 * Crea la colección cauciones.
 * Si ya existe (p. ej. schema viejo / migrate a medias), la reemplaza.
 */
export async function up(pb) {
  try {
    await pb.deleteCollection('cauciones')
    console.log('[migrate] 002_cauciones deleted existing collection')
  } catch (err) {
    if (err?.response?.status !== 404) throw err
  }

  await pb.createCollection(CAUCIONES_COLLECTION)
  console.log('[migrate] 002_cauciones created collection')
}

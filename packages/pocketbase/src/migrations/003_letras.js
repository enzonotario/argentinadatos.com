import { LETRAS_COLLECTION } from '../schema/finanzas.js'
import { recreateCollection } from './recreate.js'

export const id = '003_letras'
export async function up(pb) {
  await recreateCollection(pb, LETRAS_COLLECTION)
}

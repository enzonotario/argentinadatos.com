import { CAUCIONES_COLLECTION } from '../schema/cauciones.js'
import { recreateCollection } from './recreate.js'

export const id = '002_cauciones'
export async function up(pb) {
  await recreateCollection(pb, CAUCIONES_COLLECTION)
}

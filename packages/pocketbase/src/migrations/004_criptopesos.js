import { CRIPTOPESOS_COLLECTION } from '../schema/finanzas.js'
import { recreateCollection } from './recreate.js'

export const id = '004_criptopesos'
export async function up(pb) {
  await recreateCollection(pb, CRIPTOPESOS_COLLECTION)
}

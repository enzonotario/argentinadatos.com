import { FCI_OTROS_COLLECTION } from '../schema/finanzas.js'
import { recreateCollection } from './recreate.js'

export const id = '006_fci_otros'
export async function up(pb) {
  await recreateCollection(pb, FCI_OTROS_COLLECTION)
}

import { FCI_VARIABLES_COLLECTION } from '../schema/finanzas.js'
import { recreateCollection } from './recreate.js'

export const id = '007_fci_variables'
export async function up(pb) {
  await recreateCollection(pb, FCI_VARIABLES_COLLECTION)
}

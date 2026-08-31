import { CUENTAS_REMUNERADAS_USD_COLLECTION } from '../schema/finanzas.js'
import { recreateCollection } from './recreate.js'

export const id = '005_cuentas_remuneradas_usd'
export async function up(pb) {
  await recreateCollection(pb, CUENTAS_REMUNERADAS_USD_COLLECTION)
}

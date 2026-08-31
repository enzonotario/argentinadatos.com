import { REM_EXPECTATIVAS_COLLECTION } from '../schema/rem.js'
import { recreateCollection } from './recreate.js'

export const id = '008_rem_expectativas'
export async function up(pb) {
  await recreateCollection(pb, REM_EXPECTATIVAS_COLLECTION)
}

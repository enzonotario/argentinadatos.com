import {
  DIPUTADOS_ACTAS_COLLECTION,
  DIPUTADOS_COLLECTION,
  SENADORES_COLLECTION,
  SENADO_ACTAS_COLLECTION,
} from '../schema/congreso.js'
import { recreateCollection } from './recreate.js'

export const id = '009_congreso'
export async function up(pb) {
  await recreateCollection(pb, DIPUTADOS_COLLECTION)
  await recreateCollection(pb, DIPUTADOS_ACTAS_COLLECTION)
  await recreateCollection(pb, SENADORES_COLLECTION)
  await recreateCollection(pb, SENADO_ACTAS_COLLECTION)
}

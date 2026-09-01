export { getPocketBaseConfig, shouldUseMemoryBackend } from './config.js'
export {
  createHttpPocketBaseClient,
  createPocketBaseClient,
} from './client.js'
export {
  createMemoryPocketBaseClient,
  resetMemoryPocketBaseStores,
} from './memoryClient.js'
export { toPocketBaseDate, appliedAtNow } from './dates.js'
export { escapeFilterValue, eq, andFilters } from './filter.js'
export {
  listAllRecords,
  findFirstRecord,
  upsertByFilter,
} from './records.js'
export { runMigrations, resetCaucionesAndMigrate } from './migrate.js'
export { migrations } from './migrations/index.js'

export {
  CAUCIONES_COLLECTION,
  classifyCaucionMoneda,
  fechaOperacionHoy,
  caucionSerieKey,
  mergeTasaMinMaxDia,
  fieldNames,
  findField,
} from './schema/cauciones.js'
export {
  LETRAS_COLLECTION,
  CRIPTOPESOS_COLLECTION,
  CUENTAS_REMUNERADAS_USD_COLLECTION,
  FCI_OTROS_COLLECTION,
} from './schema/finanzas.js'
export { REM_EXPECTATIVAS_COLLECTION } from './schema/rem.js'
export {
  DIPUTADOS_COLLECTION,
  DIPUTADOS_ACTAS_COLLECTION,
  SENADORES_COLLECTION,
  SENADO_ACTAS_COLLECTION,
} from './schema/congreso.js'

export {
  LetrasRepository,
  CriptopesosRepository,
  CuentasRemuneradasUsdRepository,
} from './repositories/finanzas-simple.js'
export {
  FciOtrosRepository,
} from './repositories/fci.js'
export { RemRepository } from './repositories/rem.js'
export {
  DiputadosRepository,
  DiputadosActasRepository,
  SenadoresRepository,
  SenadoActasRepository,
} from './repositories/congreso.js'
export {
  replaceCauciones,
  listCaucionesByMoneda,
  buildExistingMinMaxBySerie,
} from './repositories/cauciones.js'

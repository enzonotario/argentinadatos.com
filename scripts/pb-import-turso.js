import { readFile } from 'node:fs/promises'
import { config } from 'dotenv'
import {
  andFilters,
  createPocketBaseClient,
  eq,
  runMigrations,
  toPocketBaseDate,
  upsertByFilter,
} from '@argentinadatos/pocketbase'

config()

const IMPORT_TABLES = [
  'letras',
  'criptopesos',
  'cuentas_remuneradas_usd',
  'fci_otros',
  'fci_variables',
  'rem_expectativas',
  'diputados',
  'diputados_actas',
  'senadores',
  'senado_actas',
]

/**
 * Importa un dump de `scripts/turso-export.js` hacia PocketBase.
 * Uso:
 *   node scripts/pb-import-turso.js [turso-export.json]
 *   node scripts/pb-import-turso.js --fresh [turso-export.json]
 *   node scripts/pb-import-turso.js --only diputados_actas,senadores,senado_actas --fresh
 *   node scripts/pb-import-turso.js --skip letras,criptopesos,fci_otros
 *
 * --fresh trunca solo las colecciones que se van a importar en esta corrida.
 * --only / --skip filtran tablas (nombres separados por coma).
 */
function parseCliArgs(argv) {
  const positional = []
  let fresh = false
  let only = null
  let skip = new Set()

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--fresh') {
      fresh = true
      continue
    }
    if (arg === '--only' || arg.startsWith('--only=')) {
      const value =
        arg.includes('=') ? arg.slice('--only='.length) : argv[++i]
      only = new Set(
        value
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      )
      continue
    }
    if (arg === '--skip' || arg.startsWith('--skip=')) {
      const value =
        arg.includes('=') ? arg.slice('--skip='.length) : argv[++i]
      for (const name of value.split(',').map(s => s.trim()).filter(Boolean)) {
        skip.add(name)
      }
      continue
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`)
    }
    positional.push(arg)
  }

  return { fresh, only, skip, dumpPath: positional[0] || 'turso-export.json' }
}

function resolveImportTables({ only, skip }) {
  let tables = IMPORT_TABLES
  if (only?.size) {
    tables = IMPORT_TABLES.filter(name => only.has(name))
    const unknown = [...only].filter(name => !IMPORT_TABLES.includes(name))
    if (unknown.length) {
      throw new Error(
        `Unknown --only table(s): ${unknown.join(', ')}. Valid: ${IMPORT_TABLES.join(', ')}`,
      )
    }
  }
  if (skip.size) {
    tables = tables.filter(name => !skip.has(name))
  }
  return tables
}

async function main() {
  const { fresh, only, skip, dumpPath } = parseCliArgs(process.argv.slice(2))
  const tablesToImport = resolveImportTables({ only, skip })

  if (tablesToImport.length === 0) {
    throw new Error('No tables selected to import (--only / --skip)')
  }

  console.log(`[import] tables: ${tablesToImport.join(', ')}`)
  if (only?.size || skip.size) {
    console.log('[import] resuming partial import (skipped tables untouched)')
  }

  const raw = JSON.parse(await readFile(dumpPath, 'utf8'))
  const tables = raw.tables || {}
  const pb = createPocketBaseClient()
  await runMigrations(pb)

  const importers = {
    letras: importLetras,
    criptopesos: importCriptopesos,
    cuentas_remuneradas_usd: importCuentasRemuneradasUsd,
    fci_otros: importFciOtros,
    fci_variables: importFciVariables,
    rem_expectativas: importRem,
    diputados: importDiputados,
    diputados_actas: importDiputadosActas,
    senadores: importSenadores,
    senado_actas: importSenadoActas,
  }

  for (const table of tablesToImport) {
    const rows = tables[table]
    if (!rows) {
      console.warn(`[import] skip missing table ${table}`)
      continue
    }
    const importer = importers[table]
    if (fresh) {
      await pb.truncateCollection(table)
      console.log(`[import] truncated ${table}`)
    }
    const count = await importer(pb, rows)
    console.log(`[import] ${table}: ${count}/${rows.length} records`)
  }
}

async function upsertOrThrow(pb, collection, filter, body, meta) {
  try {
    await upsertByFilter(pb, collection, filter, body)
  } catch (err) {
    const detail = err?.response?.data || err.message
    throw new Error(
      `[import] ${collection} idx=${meta.index} failed: ${JSON.stringify(detail)} row=${JSON.stringify(meta.row)}`,
    )
  }
}

function sanitizeInt(value) {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? Math.trunc(num) : null
}

/** Turso acumula re-crawls; quedarse con el snapshot más reciente por clave. */
function dedupeDiputadosActas(rows) {
  const byKey = new Map()
  for (const row of rows) {
    const actaId = sanitizeInt(row.actaId)
    const anio = sanitizeInt(row.año ?? row.anio)
    if (actaId == null || anio == null) continue
    const key = `${actaId}|${anio}`
    const prev = byKey.get(key)
    if (!prev || String(row.timestamp || '') >= String(prev.timestamp || '')) {
      byKey.set(key, row)
    }
  }
  return [...byKey.values()]
}

async function createOrThrow(pb, collection, body, meta) {
  try {
    await pb.createRecord(collection, body)
  } catch (err) {
    const detail = err?.response?.data || err.message
    throw new Error(
      `[import] ${collection} idx=${meta.index} failed: ${JSON.stringify(detail)} row=${JSON.stringify(meta.row)}`,
    )
  }
}

async function importLetras(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    await upsertOrThrow(
      pb,
      'letras',
      eq('ticker', row.ticker),
      {
        ticker: row.ticker,
        fechaEmision: row.fechaEmision ?? null,
        fechaVencimiento: row.fechaVencimiento,
        tem: row.tem ?? null,
        vpv: row.vpv,
        fechaActualizacion: toPocketBaseDate(
          row.fechaActualizacion || new Date(),
        ),
      },
      { index, row },
    )
    n += 1
  }
  return n
}

async function importCriptopesos(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    await createOrThrow(
      pb,
      'criptopesos',
      {
        token: row.token,
        entidad: row.entidad,
        tna: Number(row.tna),
        timestamp: row.timestamp,
      },
      { index, row: { token: row.token, entidad: row.entidad, tna: row.tna } },
    )
    n += 1
  }
  return n
}

async function importCuentasRemuneradasUsd(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    await createOrThrow(
      pb,
      'cuentas_remuneradas_usd',
      {
        entidad: row.entidad,
        tasa: Number(row.tasa),
        tope: row.tope ?? null,
        timestamp: row.timestamp,
      },
      { index, row: { entidad: row.entidad, tasa: row.tasa } },
    )
    n += 1
  }
  return n
}

async function importFciOtros(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    await createOrThrow(
      pb,
      'fci_otros',
      {
        fondo: row.fondo,
        tna: Number(row.tna),
        tea: Number(row.tea),
        tope: row.tope ?? null,
        fecha: row.fecha,
        condiciones: row.condiciones ?? null,
        condicionesCorto: row.condicionesCorto ?? null,
        plazoMinDias: row.plazoMinDias ?? null,
        plazoMaxDias: row.plazoMaxDias ?? null,
        timestamp: row.timestamp,
      },
      { index, row: { fondo: row.fondo, tna: row.tna, fecha: row.fecha } },
    )
    n += 1
  }
  return n
}

async function importFciVariables(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    await createOrThrow(
      pb,
      'fci_variables',
      {
        nombre: row.nombre ?? null,
        fondo: row.fondo,
        tipo: row.tipo ?? null,
        tna: Number(row.tna),
        tea: Number(row.tea),
        tope: row.tope ?? null,
        fecha: row.fecha,
        condiciones: row.condiciones ?? null,
        condicionesCorto: row.condicionesCorto ?? null,
        timestamp: row.timestamp,
      },
      { index, row: { nombre: row.nombre, tna: row.tna } },
    )
    n += 1
  }
  return n
}

async function importRem(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    const body = {
      informe: row.informe,
      fecha: row.fecha ?? null,
      muestra: row.muestra,
      indicador: row.indicador,
      periodo: row.periodo,
      periodoTipo: row.periodoTipo ?? null,
      periodoDesde: row.periodoDesde ?? null,
      periodoHasta: row.periodoHasta ?? null,
      referencia: row.referencia,
      referenciaFecha: row.referenciaFecha ?? null,
      unidad: row.unidad ?? null,
      mediana: row.mediana ?? null,
      promedio: row.promedio ?? null,
      desvio: row.desvio ?? null,
      maximo: row.maximo ?? null,
      minimo: row.minimo ?? null,
      percentil90: row.percentil90 ?? null,
      percentil75: row.percentil75 ?? null,
      percentil25: row.percentil25 ?? null,
      percentil10: row.percentil10 ?? null,
      participantes: row.participantes ?? null,
      fuente: row.fuente ?? row.src ?? null,
      publicacionUrl: row.publicacionUrl ?? null,
      xlsxUrl: row.xlsxUrl ?? null,
      fechaActualizacion: toPocketBaseDate(
        row.fechaActualizacion || new Date(),
      ),
    }
    await upsertOrThrow(
      pb,
      'rem_expectativas',
      andFilters(
        eq('informe', body.informe),
        eq('muestra', body.muestra),
        eq('indicador', body.indicador),
        eq('periodo', body.periodo),
        eq('referencia', body.referencia),
      ),
      body,
      { index, row: { informe: row.informe, indicador: row.indicador } },
    )
    n += 1
  }
  return n
}

function parseJsonMaybe(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

async function importDiputados(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    const body = {
      diputadoId: String(row.diputadoId),
      nombre: row.nombre,
      apellido: row.apellido ?? null,
      genero: row.genero ?? null,
      provincia: row.provincia ?? null,
      periodoMandatoInicio: row.periodoMandatoInicio,
      periodoMandatoFin: row.periodoMandatoFin ?? null,
      juramentoFecha: row.juramentoFecha ?? null,
      ceseFecha: row.ceseFecha ?? null,
      bloque: row.bloque ?? null,
      periodoBloqueInicio: row.periodoBloqueInicio ?? null,
      periodoBloqueFin: row.periodoBloqueFin ?? null,
      foto: row.foto ?? null,
      data: parseJsonMaybe(row.data),
      timestamp: row.timestamp,
    }
    await upsertOrThrow(
      pb,
      'diputados',
      andFilters(
        eq('diputadoId', body.diputadoId),
        eq('periodoMandatoInicio', body.periodoMandatoInicio),
      ),
      body,
      { index, row: { diputadoId: row.diputadoId } },
    )
    n += 1
  }
  return n
}

async function importDiputadosActas(pb, rows) {
  const deduped = dedupeDiputadosActas(rows)
  if (deduped.length < rows.length) {
    console.log(
      `[import] diputados_actas deduped ${rows.length} → ${deduped.length} (latest timestamp wins)`,
    )
  }
  let n = 0
  for (const [index, row] of deduped.entries()) {
    const actaId = sanitizeInt(row.actaId)
    const anio = sanitizeInt(row.año ?? row.anio)
    const body = {
      actaId,
      anio,
      periodo: row.periodo ?? null,
      reunion: row.reunion ?? null,
      numeroActa: row.numeroActa ?? null,
      titulo: row.titulo ?? null,
      resultado: row.resultado ?? null,
      fecha: row.fecha ?? null,
      presidente: row.presidente ?? null,
      votosAfirmativos: row.votosAfirmativos ?? null,
      votosNegativos: row.votosNegativos ?? null,
      abstenciones: row.abstenciones ?? null,
      ausentes: row.ausentes ?? null,
      data: parseJsonMaybe(row.data),
      timestamp: row.timestamp,
    }
    await upsertOrThrow(
      pb,
      'diputados_actas',
      andFilters(eq('actaId', actaId), eq('anio', anio)),
      body,
      { index, row: { actaId, anio } },
    )
    n += 1
  }
  return n
}

async function importSenadores(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    const senadorId = sanitizeInt(row.senadorId)
    const body = {
      senadorId,
      nombre: row.nombre,
      provincia: row.provincia ?? null,
      partido: row.partido ?? null,
      periodoLegalInicio: row.periodoLegalInicio,
      periodoLegalFin: row.periodoLegalFin ?? null,
      periodoRealInicio: row.periodoRealInicio ?? null,
      periodoRealFin: row.periodoRealFin ?? null,
      reemplazo: row.reemplazo ?? null,
      observaciones: row.observaciones ?? null,
      foto: row.foto ?? null,
      email: row.email ?? null,
      telefono: row.telefono ?? null,
      redes: row.redes ?? null,
      data: parseJsonMaybe(row.data),
      timestamp: row.timestamp,
    }
    await upsertOrThrow(
      pb,
      'senadores',
      andFilters(
        eq('senadorId', senadorId),
        eq('periodoLegalInicio', body.periodoLegalInicio),
      ),
      body,
      { index, row: { senadorId: row.senadorId } },
    )
    n += 1
  }
  return n
}

async function importSenadoActas(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    const actaId = sanitizeInt(row.actaId)
    const anio = sanitizeInt(row.año ?? row.anio)
    const body = {
      actaId,
      anio,
      titulo: row.titulo ?? null,
      fecha: row.fecha ?? null,
      votosAfirmativos: row.votosAfirmativos ?? null,
      votosNegativos: row.votosNegativos ?? null,
      abstenciones: row.abstenciones ?? null,
      ausentes: row.ausentes ?? null,
      presidente: row.presidente ?? null,
      data: parseJsonMaybe(row.data),
      timestamp: row.timestamp,
    }
    await upsertOrThrow(
      pb,
      'senado_actas',
      andFilters(eq('actaId', actaId), eq('anio', anio)),
      body,
      { index, row: { actaId, anio } },
    )
    n += 1
  }
  return n
}

main().catch(err => {
  console.error(err?.message || err?.response?.data || err)
  process.exit(1)
})

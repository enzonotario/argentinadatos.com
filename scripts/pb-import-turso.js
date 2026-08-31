import { readFile } from 'node:fs/promises'
import { config } from 'dotenv'
import {
  createPocketBaseClient,
  runMigrations,
  toPocketBaseDate,
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
 *
 * --fresh trunca las colecciones a importar antes de cargar (recomendado
 * si un import anterior quedó a medias).
 */
async function main() {
  const args = process.argv.slice(2).filter(a => a !== '--fresh')
  const fresh = process.argv.includes('--fresh')
  const dumpPath = args[0] || 'turso-export.json'
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

  for (const table of IMPORT_TABLES) {
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
    await createOrThrow(
      pb,
      'letras',
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
    await createOrThrow(
      pb,
      'rem_expectativas',
      {
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
      },
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
    await createOrThrow(
      pb,
      'diputados',
      {
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
      },
      { index, row: { diputadoId: row.diputadoId } },
    )
    n += 1
  }
  return n
}

async function importDiputadosActas(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    await createOrThrow(
      pb,
      'diputados_actas',
      {
        actaId: Number(row.actaId),
        anio: Number(row.año ?? row.anio),
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
      },
      { index, row: { actaId: row.actaId, anio: row.año ?? row.anio } },
    )
    n += 1
  }
  return n
}

async function importSenadores(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    await createOrThrow(
      pb,
      'senadores',
      {
        senadorId: Number(row.senadorId),
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
      },
      { index, row: { senadorId: row.senadorId } },
    )
    n += 1
  }
  return n
}

async function importSenadoActas(pb, rows) {
  let n = 0
  for (const [index, row] of rows.entries()) {
    await createOrThrow(
      pb,
      'senado_actas',
      {
        actaId: Number(row.actaId),
        anio: Number(row.año ?? row.anio),
        titulo: row.titulo ?? null,
        fecha: row.fecha ?? null,
        votosAfirmativos: row.votosAfirmativos ?? null,
        votosNegativos: row.votosNegativos ?? null,
        abstenciones: row.abstenciones ?? null,
        ausentes: row.ausentes ?? null,
        presidente: row.presidente ?? null,
        data: parseJsonMaybe(row.data),
        timestamp: row.timestamp,
      },
      { index, row: { actaId: row.actaId, anio: row.año ?? row.anio } },
    )
    n += 1
  }
  return n
}

main().catch(err => {
  console.error(err?.message || err?.response?.data || err)
  process.exit(1)
})

import { readFile } from 'node:fs/promises'
import { config } from 'dotenv'
import {
  createPocketBaseClient,
  runMigrations,
  toPocketBaseDate,
} from '@argentinadatos/pocketbase'

config()

/**
 * Importa un dump de `scripts/turso-export.js` hacia PocketBase.
 * Uso: node scripts/pb-import-turso.js [turso-export.json]
 *
 * Requiere POCKETBASE_URL + POCKETBASE_TOKEN.
 */
async function main() {
  const dumpPath = process.argv[2] || 'turso-export.json'
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

  for (const [table, rows] of Object.entries(tables)) {
    const importer = importers[table]
    if (!importer) {
      console.warn(`[import] no importer for ${table}`)
      continue
    }
    const count = await importer(pb, rows || [])
    console.log(`[import] ${table}: ${count} records`)
  }
}

async function importLetras(pb, rows) {
  let n = 0
  for (const row of rows) {
    await pb.createRecord('letras', {
      ticker: row.ticker,
      fechaEmision: row.fechaEmision ?? null,
      fechaVencimiento: row.fechaVencimiento,
      tem: row.tem ?? null,
      vpv: row.vpv,
      fechaActualizacion: toPocketBaseDate(
        row.fechaActualizacion || new Date(),
      ),
    })
    n += 1
  }
  return n
}

async function importCriptopesos(pb, rows) {
  let n = 0
  for (const row of rows) {
    await pb.createRecord('criptopesos', {
      token: row.token,
      entidad: row.entidad,
      tna: row.tna,
      timestamp: row.timestamp,
    })
    n += 1
  }
  return n
}

async function importCuentasRemuneradasUsd(pb, rows) {
  let n = 0
  for (const row of rows) {
    await pb.createRecord('cuentas_remuneradas_usd', {
      entidad: row.entidad,
      tasa: row.tasa,
      tope: row.tope ?? null,
      timestamp: row.timestamp,
    })
    n += 1
  }
  return n
}

async function importFciOtros(pb, rows) {
  let n = 0
  for (const row of rows) {
    await pb.createRecord('fci_otros', {
      fondo: row.fondo,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope ?? null,
      fecha: row.fecha,
      condiciones: row.condiciones ?? null,
      condicionesCorto: row.condicionesCorto ?? null,
      plazoMinDias: row.plazoMinDias ?? null,
      plazoMaxDias: row.plazoMaxDias ?? null,
      timestamp: row.timestamp,
    })
    n += 1
  }
  return n
}

async function importFciVariables(pb, rows) {
  let n = 0
  for (const row of rows) {
    await pb.createRecord('fci_variables', {
      nombre: row.nombre ?? null,
      fondo: row.fondo,
      tipo: row.tipo ?? null,
      tna: row.tna,
      tea: row.tea,
      tope: row.tope ?? null,
      fecha: row.fecha,
      condiciones: row.condiciones ?? null,
      condicionesCorto: row.condicionesCorto ?? null,
      timestamp: row.timestamp,
    })
    n += 1
  }
  return n
}

async function importRem(pb, rows) {
  let n = 0
  for (const row of rows) {
    await pb.createRecord('rem_expectativas', {
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
    })
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
  for (const row of rows) {
    await pb.createRecord('diputados', {
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
    })
    n += 1
  }
  return n
}

async function importDiputadosActas(pb, rows) {
  let n = 0
  for (const row of rows) {
    await pb.createRecord('diputados_actas', {
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
    })
    n += 1
  }
  return n
}

async function importSenadores(pb, rows) {
  let n = 0
  for (const row of rows) {
    await pb.createRecord('senadores', {
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
    })
    n += 1
  }
  return n
}

async function importSenadoActas(pb, rows) {
  let n = 0
  for (const row of rows) {
    await pb.createRecord('senado_actas', {
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
    })
    n += 1
  }
  return n
}

main().catch(err => {
  console.error(err?.response?.data || err)
  process.exit(1)
})

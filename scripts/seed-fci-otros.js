import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { parse, compareAsc } from 'date-fns'
import { config } from 'dotenv'
import {
  crearClienteLibsql,
  resolverConexionLibsql,
} from '../src/utils/libsql.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

config({ path: join(rootDir, '.env') })

const DATOS_DIR = join(rootDir, 'datos/v1/finanzas/fci/otros')

function normalizarValor(valor) {
  if (valor === null || valor === undefined) {
    return null
  }
  return valor
}

function valoresIguales(item1, item2) {
  return (
    item1.tna === item2.tna &&
    item1.tea === item2.tea &&
    normalizarValor(item1.tope) === normalizarValor(item2.tope) &&
    normalizarValor(item1.condiciones) === normalizarValor(item2.condiciones) &&
    normalizarValor(item1.condicionesCorto) ===
      normalizarValor(item2.condicionesCorto) &&
    normalizarValor(item1.plazoMinDias) ===
      normalizarValor(item2.plazoMinDias) &&
    normalizarValor(item1.plazoMaxDias) === normalizarValor(item2.plazoMaxDias)
  )
}

async function obtenerArchivosRecursivos(dir, archivos = []) {
  const items = await readdir(dir, { withFileTypes: true })

  for (const item of items) {
    const rutaCompleta = join(dir, item.name)

    if (item.isDirectory()) {
      if (item.name !== 'ultimo' && item.name !== 'penultimo') {
        await obtenerArchivosRecursivos(rutaCompleta, archivos)
      }
    } else if (item.isFile() && item.name === 'index.json') {
      archivos.push(rutaCompleta)
    }
  }

  return archivos
}

async function leerArchivo(ruta) {
  try {
    const contenido = await readFile(ruta, 'utf-8')
    const datos = JSON.parse(contenido)
    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

async function inicializarBaseDatos(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      scope TEXT NOT NULL,
      version INTEGER NOT NULL,
      name TEXT NOT NULL,
      executed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (scope, version)
    )
  `)

  const resultado = await db.execute({
    sql: 'SELECT version FROM migrations WHERE scope = ?',
    args: ['fci-otros'],
  })
  const executedMigrations = new Set(
    resultado.rows.map(row => Number(row.version)),
  )

  if (!executedMigrations.has(1)) {
    console.log(
      'Ejecutando migración 001: creando esquema inicial de fci otros...',
    )

    await db.execute(`
      CREATE TABLE IF NOT EXISTS fci_otros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fondo TEXT NOT NULL,
        tna REAL NOT NULL,
        tea REAL NOT NULL,
        tope REAL,
        fecha TEXT NOT NULL,
        condiciones TEXT,
        condicionesCorto TEXT,
        plazoMinDias INTEGER,
        plazoMaxDias INTEGER,
        timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fci_otros_fondo ON fci_otros(fondo)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fci_otros_timestamp ON fci_otros(timestamp)
    `)

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_fci_otros_fecha ON fci_otros(fecha)
    `)

    await db.execute({
      sql: 'INSERT INTO migrations (scope, version, name) VALUES (?, ?, ?)',
      args: ['fci-otros', 1, 'initial_schema'],
    })

    console.log('Migración 001 completada: esquema inicial creado exitosamente')
  }

  if (!executedMigrations.has(2)) {
    console.log('Ejecutando migración 002: agregando columnas de plazo...')

    for (const columna of ['plazoMinDias', 'plazoMaxDias']) {
      try {
        await db.execute(`
          ALTER TABLE fci_otros ADD COLUMN ${columna} INTEGER
        `)
      } catch (error) {
        if (!String(error).includes(`duplicate column name: ${columna}`)) {
          throw error
        }
      }
    }

    await db.execute({
      sql: 'INSERT INTO migrations (scope, version, name) VALUES (?, ?, ?)',
      args: ['fci-otros', 2, 'add_plazo_columns'],
    })

    console.log('Migración 002 completada: columnas de plazo agregadas')
  }
}

async function getLatestFciOtrosByFondo(db, fondo) {
  const resultado = await db.execute({
    sql: `
      SELECT id, fondo, tna, tea, tope, fecha, condiciones, condicionesCorto,
             plazoMinDias, plazoMaxDias, timestamp
      FROM fci_otros
      WHERE fondo = ?
      ORDER BY timestamp DESC, created_at DESC
      LIMIT 1
    `,
    args: [fondo],
  })
  if (resultado.rows.length === 0) {
    return null
  }
  const row = resultado.rows[0]
  return {
    id: row.id,
    fondo: row.fondo,
    tna: row.tna,
    tea: row.tea,
    tope: row.tope,
    fecha: row.fecha,
    condiciones: row.condiciones,
    condicionesCorto: row.condicionesCorto,
    plazoMinDias: row.plazoMinDias ?? null,
    plazoMaxDias: row.plazoMaxDias ?? null,
    timestamp: row.timestamp,
  }
}

async function insertFciOtros(
  db,
  fondo,
  tna,
  tea,
  tope,
  fecha,
  condiciones,
  condicionesCorto,
  plazoMinDias,
  plazoMaxDias,
  timestamp,
) {
  await db.execute({
    sql: `
      INSERT INTO fci_otros (
        fondo, tna, tea, tope, fecha, condiciones, condicionesCorto,
        plazoMinDias, plazoMaxDias, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      fondo,
      tna,
      tea,
      tope,
      fecha,
      condiciones,
      condicionesCorto,
      plazoMinDias,
      plazoMaxDias,
      timestamp,
    ],
  })
}

async function procesarArchivos() {
  console.log('Buscando archivos JSON...')
  const archivos = await obtenerArchivosRecursivos(DATOS_DIR)
  console.log(`Encontrados ${archivos.length} archivos`)

  const todosLosDatos = []

  for (const archivo of archivos) {
    const datos = await leerArchivo(archivo)
    todosLosDatos.push(...datos)
  }

  console.log(`Total de registros leídos: ${todosLosDatos.length}`)

  const datosPorFondo = {}

  for (const item of todosLosDatos) {
    if (!item.fondo || !item.fecha) {
      continue
    }

    if (!datosPorFondo[item.fondo]) {
      datosPorFondo[item.fondo] = []
    }

    datosPorFondo[item.fondo].push({
      fondo: item.fondo,
      tna: item.tna,
      tea: item.tea,
      tope: normalizarValor(item.tope),
      fecha: item.fecha,
      condiciones: normalizarValor(item.condiciones),
      condicionesCorto: normalizarValor(item.condicionesCorto),
      plazoMinDias: normalizarValor(item.plazoMinDias),
      plazoMaxDias: normalizarValor(item.plazoMaxDias),
    })
  }

  const datosParaInsertar = []

  for (const fondo of Object.keys(datosPorFondo)) {
    const registros = datosPorFondo[fondo]
    registros.sort((a, b) =>
      compareAsc(
        parse(a.fecha, 'yyyy-MM-dd', new Date()),
        parse(b.fecha, 'yyyy-MM-dd', new Date()),
      ),
    )

    if (registros.length === 0) {
      continue
    }

    let ultimoInsertado = registros[0]
    datosParaInsertar.push(ultimoInsertado)

    for (let i = 1; i < registros.length; i++) {
      const actual = registros[i]

      if (!valoresIguales(ultimoInsertado, actual)) {
        datosParaInsertar.push(actual)
        ultimoInsertado = actual
      }
    }
  }

  console.log(
    `Registros a insertar después de filtrar duplicados: ${datosParaInsertar.length}`,
  )

  return datosParaInsertar
}

async function main() {
  const conexion = resolverConexionLibsql({
    scope: 'fci-otros',
  })

  const db = crearClienteLibsql({
    scope: 'fci-otros',
  })

  try {
    console.log(`Usando base de datos: ${conexion.url}`)
    console.log('Inicializando base de datos...')
    await inicializarBaseDatos(db)

    console.log('Procesando archivos...')
    const datosParaInsertar = await procesarArchivos()

    console.log(`Insertando ${datosParaInsertar.length} registros...`)

    let insertados = 0
    let omitidos = 0

    for (const item of datosParaInsertar) {
      const ultimo = await getLatestFciOtrosByFondo(db, item.fondo)

      if (
        !ultimo ||
        ultimo.tna !== item.tna ||
        ultimo.tea !== item.tea ||
        ultimo.tope !== item.tope ||
        ultimo.condiciones !== item.condiciones ||
        ultimo.condicionesCorto !== item.condicionesCorto ||
        ultimo.plazoMinDias !== item.plazoMinDias ||
        ultimo.plazoMaxDias !== item.plazoMaxDias
      ) {
        const timestamp = parse(
          item.fecha,
          'yyyy-MM-dd',
          new Date(),
        ).toISOString()
        await insertFciOtros(
          db,
          item.fondo,
          item.tna,
          item.tea,
          item.tope,
          item.fecha,
          item.condiciones,
          item.condicionesCorto,
          item.plazoMinDias,
          item.plazoMaxDias,
          timestamp,
        )
        insertados++
      } else {
        omitidos++
      }
    }

    console.log(
      `Seed completado: ${insertados} insertados, ${omitidos} omitidos`,
    )
  } catch (error) {
    console.error('Error durante el seed:', error)
    throw error
  } finally {
    db.close()
  }
}

main()

import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'date-fns'
import { config } from 'dotenv'
import { FciOtrosDatabaseService } from '../src/finanzas/fci/otros/database/service.js'

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

async function procesarArchivos() {
  const archivos = await obtenerArchivosRecursivos(DATOS_DIR)
  console.log(`Archivos encontrados: ${archivos.length}`)

  const porFondo = new Map()

  for (const archivo of archivos) {
    const datos = await leerArchivo(archivo)
    for (const item of datos) {
      if (!item?.fondo || !item?.fecha) continue
      if (!porFondo.has(item.fondo)) {
        porFondo.set(item.fondo, [])
      }
      porFondo.get(item.fondo).push(item)
    }
  }

  const datosParaInsertar = []

  for (const [, items] of porFondo) {
    items.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    let ultimoInsertado = null
    for (const actual of items) {
      if (!ultimoInsertado || !valoresIguales(ultimoInsertado, actual)) {
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
  const db = new FciOtrosDatabaseService()

  try {
    console.log('Inicializando PocketBase (fci_otros)...')
    await db.initialize()

    console.log('Procesando archivos...')
    const datosParaInsertar = await procesarArchivos()

    console.log(`Insertando ${datosParaInsertar.length} registros...`)

    let insertados = 0
    let omitidos = 0

    for (const item of datosParaInsertar) {
      const ultimo = await db.getLatestFciOtrosByFondo(item.fondo)

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
        await db.insertFciOtros(
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

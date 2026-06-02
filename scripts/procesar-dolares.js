import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')
process.chdir(projectRoot)

import { format, parseISO, addDays, subDays } from 'date-fns'
import { leerRuta, escribirRuta, existeRuta } from '../src/utils/rutas.js'
import { collect } from 'collect.js'

/**
 * Rellena los días faltantes en el archivo principal /dolares/index.json
 * Copia los valores del día anterior para cada casa cuando falta un día
 */
async function rellenarDiasFaltantes() {
  const dolares = await leerRuta('/cotizaciones/dolares')

  const output = []

  const fechas = collect(dolares).pluck('fecha').unique().sort().toArray()

  const primeraFecha = fechas[0]
  const ultimaFecha = fechas[fechas.length - 1]

  const fechaActual = parseISO(primeraFecha)
  const fechaFinal = parseISO(ultimaFecha)

  const fechasFaltantes = []

  while (fechaActual <= fechaFinal) {
    const fecha = format(fechaActual, 'yyyy/MM/dd')

    const existe = await existeRuta(`/cotizaciones/dolares/${fecha}`)

    if (existe) {
      output.push(
        ...collect(dolares)
          .where('fecha', format(fechaActual, 'yyyy-MM-dd'))
          .toArray(),
      )
    } else {
      // Copiar del día anterior
      const fechaCopiada = new Date(fechaActual)

      const agregar = collect(output)
        .where(
          'fecha',
          format(
            new Date(fechaCopiada.setDate(fechaCopiada.getDate() - 1)),
            'yyyy-MM-dd',
          ),
        )
        .map(dolar => ({
          ...dolar,
          fecha: format(fechaActual, 'yyyy-MM-dd'),
        }))
        .toArray()

      output.push(...agregar)

      fechasFaltantes.push({
        fecha: format(fechaActual, 'yyyy-MM-dd'),
        agregar,
      })

      console.log(['Falta', format(fechaActual, 'yyyy-MM-dd'), agregar])
    }

    fechaActual.setDate(fechaActual.getDate() + 1)
  }

  if (fechasFaltantes.length > 0) {
    await escribirRuta('/cotizaciones/dolares', output, false)
    console.log(`Se rellenaron ${fechasFaltantes.length} días faltantes`)
  } else {
    console.log('No hay días faltantes')
  }
}

/**
 * Rellena los días faltantes por cada casa individualmente
 * Respeta la fecha de fin del dólar solidario (2023-12-13)
 */
async function rellenarDiasFaltantesPorCasa() {
  const finSolidario = '2023-12-13'

  const dolares = await leerRuta('/cotizaciones/dolares')

  const output = []

  const casas = collect(dolares).pluck('casa').unique().sort().toArray()

  const fechas = collect(dolares).pluck('fecha').unique().sort().toArray()

  const dolaresCollect = collect(dolares)

  const primeraFecha = fechas[0]
  const ultimaFecha = fechas[fechas.length - 1]

  let fechaActual = parseISO(primeraFecha)
  const fechaFinal = parseISO(ultimaFecha)

  let diasAgregados = 0

  while (fechaActual <= fechaFinal) {
    for (const casa of casas) {
      if (casa === 'solidario' && fechaActual > parseISO(finSolidario)) {
        continue
      }

      const existe = dolaresCollect
        .where('casa', casa)
        .where('fecha', format(fechaActual, 'yyyy-MM-dd'))
        .first()

      if (existe) {
        output.push(existe)
        continue
      }

      const fechaCopiada = new Date(fechaActual)

      const agregar = dolaresCollect
        .where('casa', casa)
        .where(
          'fecha',
          format(subDays(new Date(fechaCopiada), 1), 'yyyy-MM-dd'),
        )
        .map(dolar => ({
          ...dolar,
          fecha: format(fechaActual, 'yyyy-MM-dd'),
        }))
        .toArray()

      if (agregar.length > 0) {
        output.push(...agregar)
        dolaresCollect.push(...agregar)
        diasAgregados++
      }
    }

    fechaActual = addDays(fechaActual, 1)
  }

  if (diasAgregados > 0) {
    await escribirRuta('/cotizaciones/dolares', output, false)
    console.log(`Se agregaron ${diasAgregados} registros faltantes por casa`)
  } else {
    console.log('No hay registros faltantes por casa')
  }
}

/**
 * Re-ordena y formatea el archivo principal /dolares/index.json
 * Ordena por fecha y mantiene solo los campos necesarios
 */
async function prettify() {
  const dolares = await leerRuta('/cotizaciones/dolares')

  const formateado = collect(dolares)
    .sortBy('fecha')
    .map(dolar => ({
      casa: dolar.casa,
      compra: dolar.compra,
      venta: dolar.venta,
      fecha: dolar.fecha,
    }))
    .toArray()

  const normalizado = dolares
    .map(dolar => ({
      casa: dolar.casa,
      compra: dolar.compra,
      venta: dolar.venta,
      fecha: dolar.fecha,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (JSON.stringify(normalizado) !== JSON.stringify(formateado)) {
    await escribirRuta('/cotizaciones/dolares', formateado, false)
    console.log('Se reordenó y formateó el archivo principal')
  } else {
    console.log('El archivo principal ya está formateado correctamente')
  }
}

/**
 * Guarda cada dólar en su carpeta correspondiente:
 * - /dolares/:casa/:fecha/index.json
 * - /dolares/:casa/index.json (todos los de una casa)
 * - /dolares/:fecha/index.json (todos los de una fecha)
 */
async function guardarPorCarpetas() {
  const dolares = await leerRuta('/cotizaciones/dolares')

  let cambios = 0

  // Guardar por casa/fecha individual
  await collect(dolares)
    .groupBy('casa')
    .map(async dolaresPorCasa => {
      await dolaresPorCasa.map(async dolar => {
        const ruta = `/cotizaciones/dolares/${dolar.casa}/${format(
          parseISO(dolar.fecha),
          'yyyy/MM/dd',
        )}`

        const existente = await leerRuta(ruta)
        const nuevo = {
          casa: dolar.casa,
          compra: dolar.compra,
          venta: dolar.venta,
          fecha: dolar.fecha,
        }

        if (JSON.stringify(existente) !== JSON.stringify(nuevo)) {
          await escribirRuta(ruta, nuevo)
          cambios++
        }
      })

      // Guardar todos los de una casa
      const rutaCasa = `/cotizaciones/dolares/${dolaresPorCasa.first().casa}`
      const datosCasa = dolaresPorCasa
        .toArray()
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map(dolar => ({
          casa: dolar.casa,
          compra: dolar.compra,
          venta: dolar.venta,
          fecha: dolar.fecha,
        }))

      const existenteCasa = await leerRuta(rutaCasa)
      if (existenteCasa && Array.isArray(existenteCasa)) {
        existenteCasa.sort((a, b) => a.fecha.localeCompare(b.fecha))
      }
      if (JSON.stringify(existenteCasa) !== JSON.stringify(datosCasa)) {
        await escribirRuta(rutaCasa, datosCasa, false)
        cambios++
      }
    })

  // Guardar por fecha
  await collect(dolares)
    .groupBy('fecha')
    .map(async (dolaresPorFecha, fecha) => {
      const ruta = `/cotizaciones/dolares/${format(parseISO(fecha), 'yyyy/MM/dd')}`
      const datos = dolaresPorFecha
        .toArray()
        .sort((a, b) => a.casa.localeCompare(b.casa))

      const existente = await leerRuta(ruta)
      if (existente && Array.isArray(existente)) {
        existente.sort((a, b) => a.casa.localeCompare(b.casa))
      }
      if (JSON.stringify(existente) !== JSON.stringify(datos)) {
        await escribirRuta(ruta, datos)
        cambios++
      }
    })

  console.log(`Se guardaron ${cambios} archivos en carpetas`)
}

// Ejecutar si se llama directamente
if (process.argv[1]?.includes('procesar-dolares.js')) {
  const comando = process.argv[2]

  const comandos = {
    'rellenar': rellenarDiasFaltantes,
    'rellenar-por-casa': rellenarDiasFaltantesPorCasa,
    'prettify': prettify,
    'guardar': guardarPorCarpetas,
    'todos': async () => {
      await rellenarDiasFaltantes()
      await rellenarDiasFaltantesPorCasa()
      await prettify()
      await guardarPorCarpetas()
    },
  }

  if (comandos[comando]) {
    console.log(`Ejecutando: ${comando}`)
    await comandos[comando]()
  } else {
    console.log('Comandos disponibles: rellenar, rellenar-por-casa, prettify, guardar, todos')
  }
}

export {
  rellenarDiasFaltantes,
  rellenarDiasFaltantesPorCasa,
  prettify,
  guardarPorCarpetas,
}

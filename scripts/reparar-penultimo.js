import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { format, parseISO, subDays } from 'date-fns'
import { leerRuta, escribirRuta } from '../src/utils/rutas.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
process.chdir(resolve(__dirname, '..'))

const SERIES = [
  'mercadoDinero',
  'rentaVariable',
  'rentaFija',
  'rentaMixta',
  'retornoTotal',
]

async function repararPenultimo(serie) {
  const ultimo = await leerRuta(`/finanzas/fci/${serie}/ultimo`)

  if (!ultimo || ultimo.length === 0) {
    console.log(`[${serie}] No hay datos en ultimo, saltando`)
    return
  }

  const penultimo = []

  for (const fondo of ultimo) {
    if (!fondo.fecha) {
      penultimo.push(fondo)
      continue
    }

    const fechaUltimo = parseISO(fondo.fecha)
    const fechaDiaAnterior = subDays(fechaUltimo, 1)
    const fechaPath = format(fechaDiaAnterior, 'yyyy/MM/dd')

    const datosDiaAnterior = await leerRuta(`/finanzas/fci/${serie}/${fechaPath}`)

    if (!datosDiaAnterior) {
      console.log(`[${serie}] ${fondo.fondo}: sin datos para ${format(fechaDiaAnterior, 'yyyy-MM-dd')}, se descarta`)
      continue
    }

    const anterior = datosDiaAnterior.find(d => d.fondo === fondo.fondo)

    if (!anterior) {
      console.log(`[${serie}] ${fondo.fondo}: sin datos del dia anterior, se descarta`)
      continue
    }

    penultimo.push(anterior)
  }

  if (penultimo.length > 0) {
    await escribirRuta(`/finanzas/fci/${serie}/penultimo`, penultimo)
    console.log(`[${serie}] penultimo guardado con ${penultimo.length} fondos`)
  } else {
    console.log(`[${serie}] penultimo vacío, no se guarda`)
  }
}

async function main() {
  for (const serie of SERIES) {
    await repararPenultimo(serie)
  }
  console.log('Reparación de penultimo completada')
}

main()

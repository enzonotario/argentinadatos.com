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
    if (!fondo.fondo) continue
    if (!fondo.fecha) {
      continue
    }

    const fechaUltimo = parseISO(fondo.fecha)
    let encontrado = false

    // Buscar hacia atrás hasta 30 días
    for (let diasAtras = 1; diasAtras <= 30; diasAtras++) {
      const fechaBusqueda = subDays(fechaUltimo, diasAtras)
      const fechaPath = format(fechaBusqueda, 'yyyy/MM/dd')

      const datosDia = await leerRuta(`/finanzas/fci/${serie}/${fechaPath}`)

      if (!datosDia) continue

      const anterior = datosDia.find(d => d.fondo === fondo.fondo)

      if (anterior) {
        penultimo.push(anterior)
        encontrado = true
        break
      }
    }

    if (!encontrado) {
      console.log(`[${serie}] ${fondo.fondo}: sin datos en los ultimos 30 dias, se descarta`)
    }
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

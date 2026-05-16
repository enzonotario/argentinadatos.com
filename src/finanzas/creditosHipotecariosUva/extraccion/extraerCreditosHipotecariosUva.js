import axios from 'axios'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerCreditosHipotecariosUva',
  tipo: 'extraccion',
})

const SHEET_ID_DEFECTO = '1h191b61YRkAI9Xv3_dDuNf7ejst_ziw9kacfJsnvLoM'
const GID_DEFECTO = '1120229027'

function parsearCSV(texto) {
  const filas = []
  const lineas = texto.split('\n')

  for (const linea of lineas) {
    const recortada = linea.trim()

    if (!recortada) continue

    const celdas = []
    let actual = ''
    let entreComillas = false

    for (let i = 0; i < recortada.length; i++) {
      const ch = recortada[i]

      if (ch === '"') {
        entreComillas = !entreComillas
      } else if (ch === ',' && !entreComillas) {
        celdas.push(actual)
        actual = ''
      } else {
        actual += ch
      }
    }

    celdas.push(actual)
    filas.push(celdas)
  }

  return filas
}

export async function extraerCreditosHipotecariosUva() {
  try {
    const sheetId =
      import.meta.env.VITE_FINANZAS_CREDITOS_HIPOTECARIOS_UVA_SHEET_ID ||
      SHEET_ID_DEFECTO

    const gid =
      import.meta.env.VITE_FINANZAS_CREDITOS_HIPOTECARIOS_UVA_GID || GID_DEFECTO

    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

    const respuesta = await axios.get(url, {
      responseType: 'text',
      maxRedirects: 5,
    })

    const csv = respuesta.data
    const filas = parsearCSV(csv)

    if (filas.length < 2) {
      return []
    }

    let inicio = 1

    for (let h = 0; h < filas.length; h++) {
      const cab = filas[h]

      if (cab.length >= 1 && cab[0].trim().toLowerCase() === 'banco') {
        inicio = h + 1
        break
      }
    }

    const datos = []

    for (let i = inicio; i < filas.length; i++) {
      const fila = filas[i]

      if (fila.length < 5 || !fila[0].trim()) continue

      const entidad = fila[0].trim()

      const tnaPorcentajePlano =
        Number.parseFloat(fila[1].replace('%', '').replace(',', '.').trim()) ||
        0

      const plazoMax = Number.parseInt(fila[2], 10) || 0
      const cuotaIngreso = fila[3].trim()
      const financiamiento = fila[4].trim()

      if (tnaPorcentajePlano <= 0) continue

      const tna = Number((tnaPorcentajePlano / 100).toFixed(6))

      datos.push({
        entidad,
        nombreComercial: entidad,
        tna,
        metadata: {
          plazo_max_anios: plazoMax,
          relacion_cuota_ingreso: cuotaIngreso,
          financiamiento,
        },
      })
    }

    datos.sort((a, b) => a.tna - b.tna)

    return datos
  } catch (error) {
    logError(log, error)
    return []
  }
}

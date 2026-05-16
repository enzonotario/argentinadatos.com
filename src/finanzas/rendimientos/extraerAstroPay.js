import { format } from 'date-fns'
import { obtenerFilasDeSheets } from '@/utils/gsheets.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerAstroPay',
  tipo: 'rendimientos',
})

export async function extraerAstroPay() {
  try {
    const spreadsheetId = import.meta.env.VITE_GSHEETS_ASTROPAY_SPREADSHEET_ID

    if (!spreadsheetId) {
      throw new Error(
        'VITE_GSHEETS_ASTROPAY_SPREADSHEET_ID debe estar definido',
      )
    }

    const filas = await obtenerFilasDeSheets(spreadsheetId, 'A:B')

    if (filas.length === 0) {
      return []
    }

    const fecha = format(new Date(), 'yyyy-MM-dd')
    const items = []

    for (var i = 1; i < filas.length; i++) {
      const fila = filas[i]

      if (!fila || fila.length < 2 || !fila[0] || !fila[1]) {
        continue
      }

      const moneda = fila[0].trim()

      if (!moneda) {
        continue
      }

      try {
        const apyTexto = fila[1].trim()

        if (!apyTexto) {
          continue
        }

        const apy = Number(apyTexto)

        if (isNaN(apy)) {
          continue
        }

        items.push({
          moneda: moneda.toUpperCase(),
          apy,
          fecha,
        })
      } catch (error) {
        continue
      }
    }

    return items
  } catch (error) {
    logError(log, error)
    return []
  }
}

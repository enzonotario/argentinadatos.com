import { format, parse, isAfter, differenceInDays } from 'date-fns'
import { logGrupo, logError } from '@/log.js'
import { interpretarDecimalConComa } from '@/utils/numeros.js'
import { obtenerFilasDeSheets } from '@/utils/gsheets.js'

export async function extraerUalaCuentaRemuneradaDesdeSheets() {
  const log = logGrupo({
    fuente: 'extraerUalaDesdeSheets',
    tipo: 'cuentaRemunerada',
  })

  try {
    const spreadsheetId = import.meta.env.VITE_GSHEETS_UALA_SPREADSHEET_ID

    if (!spreadsheetId) {
      throw new Error('VITE_GSHEETS_UALA_SPREADSHEET_ID debe estar definido')
    }

    const filas = await obtenerFilasDeSheets(spreadsheetId, 'A:G')

    if (filas.length === 0) {
      logError(log, new Error('No se encontraron datos en el Google Sheet'))
      return []
    }

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    var fechaMasCercana = null
    var indiceFilaMasCercana = -1
    var diferenciaMinima = Infinity

    for (var i = 1; i < filas.length; i++) {
      const fila = filas[i]

      if (!fila || fila.length === 0 || !fila[0]) {
        continue
      }

      try {
        const fechaTexto = fila[0].trim()
        const fecha = parse(fechaTexto, 'dd/MM/yy', new Date())
        fecha.setHours(0, 0, 0, 0)

        if (isAfter(fecha, hoy)) {
          continue
        }

        const diferencia = differenceInDays(hoy, fecha)

        if (diferencia >= 0 && diferencia < diferenciaMinima) {
          diferenciaMinima = diferencia
          fechaMasCercana = fecha
          indiceFilaMasCercana = i
        }
      } catch (error) {
        continue
      }
    }

    if (indiceFilaMasCercana === -1 || !fechaMasCercana) {
      logError(log, new Error('No se encontró una fecha válida anterior a hoy'))
      return []
    }

    const filaSeleccionada = filas[indiceFilaMasCercana]
    const fechaFormateada = format(fechaMasCercana, 'yyyy-MM-dd')

    const tope =
      filaSeleccionada[1] && filaSeleccionada[1].trim() !== ''
        ? Number(interpretarDecimalConComa(filaSeleccionada[1]))
        : null

    const fondos = []

    if (filaSeleccionada[2] && filaSeleccionada[2].trim() !== '') {
      const tna = interpretarDecimalConComa(filaSeleccionada[2])

      fondos.push({
        fondo: 'UALA',
        tna: Number(tna.toFixed(4)),
        tea: Number(((1 + tna / 365) ** 365 - 1).toFixed(4)),
        tope,
        fecha: fechaFormateada,
        condiciones: null,
        condicionesCorto: null,
      })
    }

    if (filaSeleccionada[3] && filaSeleccionada[3].trim() !== '') {
      const tna = interpretarDecimalConComa(filaSeleccionada[3])
      const condicionesCorto =
        filaSeleccionada[5] && filaSeleccionada[5].trim() !== ''
          ? filaSeleccionada[5].trim()
          : null

      fondos.push({
        fondo: 'UALA PLUS 1',
        tna: Number(tna.toFixed(4)),
        tea: Number(((1 + tna / 365) ** 365 - 1).toFixed(4)),
        tope,
        fecha: fechaFormateada,
        condiciones: null,
        condicionesCorto,
      })
    }

    if (filaSeleccionada[4] && filaSeleccionada[4].trim() !== '') {
      const tna = interpretarDecimalConComa(filaSeleccionada[4])
      const condicionesCorto =
        filaSeleccionada[6] && filaSeleccionada[6].trim() !== ''
          ? filaSeleccionada[6].trim()
          : null

      fondos.push({
        fondo: 'UALA PLUS 2',
        tna: Number(tna.toFixed(4)),
        tea: Number(((1 + tna / 365) ** 365 - 1).toFixed(4)),
        tope,
        fecha: fechaFormateada,
        condiciones: null,
        condicionesCorto,
      })
    }

    return fondos
  } catch (error) {
    logError(log, error)
    return []
  }
}

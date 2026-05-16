import axios from 'axios'
import { interpretarDecimalConComa } from '@/utils/numeros.js'
import { format } from 'date-fns'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerInflacionREM',
  tipo: 'extraccion',
})

export async function extraerInflacionREM() {
  try {
    const url = import.meta.env.VITE_FINANZAS_INFLACION_REM_SHEETDB_URL
    const token = import.meta.env.VITE_FINANZAS_INFLACION_REM_SHEETDB_TOKEN

    if (!url || !token) {
      throw new Error(
        'VITE_FINANZAS_INFLACION_REM_SHEETDB_URL y VITE_FINANZAS_INFLACION_REM_SHEETDB_TOKEN deben estar definidos',
      )
    }

    const respuesta = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return respuesta.data.map(item => ({
      tipo: item['Inflación'],
      fecha: normalizarMes(item['Mes']),
      valor: interpretarDecimalConComa(item['Valor']),
    }))
  } catch (error) {
    logError(log, error)
    return []
  }
}

function normalizarMes(mes) {
  try {
    const partes = mes.split('/')

    if (partes.length === 2) {
      const mesNum = Number.parseInt(partes[0], 10)
      const añoNum = Number.parseInt(partes[1], 10)
      const fecha = new Date(añoNum, mesNum - 1, 1)

      return format(fecha, 'yyyy-MM-dd')
    } else if (partes.length === 3) {
      const diaNum = Number.parseInt(partes[0], 10)
      const mesNum = Number.parseInt(partes[1], 10)
      const añoNum = Number.parseInt(partes[2], 10)
      const fecha = new Date(añoNum, mesNum - 1, 1)

      return format(fecha, 'yyyy-MM-dd')
    }

    return mes
  } catch (error) {
    logError(log, error)
    return mes
  }
}

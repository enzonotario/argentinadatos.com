import { load } from 'cheerio'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerFeriadosBancarios',
  tipo: 'extraccion',
})

const mesesNumeros = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
}

function urlParaAño(año) {
  return `https://www.bcra.gob.ar/consulta-feriados-bancarios-${año}/`
}

function parsearFecha(texto) {
  const [dia, mes, año] = texto.trim().split(/\s+/)
  const mesNumero = mesesNumeros[mes.toLowerCase()]

  if (!mesNumero) {
    throw new Error(`Mes no reconocido: ${mes}`)
  }

  return new Date(Number(año), mesNumero - 1, Number(dia))
    .toISOString()
    .split('T')[0]
}

export async function extraerFeriadosBancarios(año) {
  try {
    const url = urlParaAño(año)
    const response = await fetch(url)

    if (response.status === 404) {
      return []
    }

    if (!response.ok) {
      throw new Error(`Error al obtener feriados bancarios: ${response.status}`)
    }

    const $ = load(await response.text())
    const feriados = []

    $('#tabla-rowcolspan-events table tr').each((_, tr) => {
      const celdas = $(tr).find('td')

      if (celdas.length < 2) {
        return
      }

      const fecha = parsearFecha($(celdas[0]).text())
      const nombre = $(celdas[1]).text().trim()

      if (Number(fecha.split('-')[0]) !== año) {
        return
      }

      feriados.push({
        fecha,
        nombre,
      })
    })

    return feriados
  } catch (error) {
    logError(log, error)
    throw error
  }
}

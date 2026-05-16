import { load } from 'cheerio'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerFeriados',
  tipo: 'extraccion',
})

// Mapear los nombres de los meses a números
const mesesNumeros = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Junio: 6,
  Julio: 7,
  Agosto: 8,
  Septiembre: 9,
  Octubre: 10,
  Noviembre: 11,
  Diciembre: 12,
}

export async function extraerFeriados(año) {
  try {
    const url = `https://www.lanacion.com.ar/feriados/${año}`
    const $ = load(await (await fetch(url)).text())

    // Matriz para almacenar los feriados
    var feriados = []

    // Seleccionar los elementos que contienen los feriados
    $('div.holidays-card-calendar').each((i, div) => {
      // Extraer el mes del feriado
      const mes = $(div).find('h3.com-text').text()

      // Iterar sobre cada feriado en el mes
      $(div)
        .find('ul.holidays-list li')
        .each((j, li) => {
          // Extraer el día, tipo y nombre del feriado
          const dia = $(li).find('span').text()

          const tipo = $(li).find('span').attr('class')

          const nombre = $(li).find('h4.com-text').text()

          // Añadir el feriado a la matriz
          feriados.push({
            dia: Number(dia),
            mes: mesesNumeros[mes],
            año,
            fecha: new Date(año, mesesNumeros[mes] - 1, Number(dia))
              .toISOString()
              .split('T')[0],
            tipo: interpretarTipo(limpiarTipo(tipo)),
            nombre,
          })
        })
    })

    return feriados
  } catch (error) {
    logError(log, error)
    throw error
  }
}

function limpiarTipo(tipo) {
  // Eliminar caracteres no alfanuméricos
  return tipo.replace(/[^a-zA-Z0-9]/g, '')
}

function interpretarTipo(tipo) {
  switch (tipo) {
    case 'immovable':
      return 'inamovible'

    case 'transferable':
      return 'trasladable'

    case 'bridge':
      return 'puente'
      porDefecto: return 'otro'
  }
}

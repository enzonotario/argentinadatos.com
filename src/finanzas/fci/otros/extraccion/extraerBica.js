import { load } from 'cheerio'
import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  calcularTeaDesdeTna,
  porcentajeADecimal,
  redondearTasa,
} from '@/finanzas/compartido/utils/tasas.js'

const URL_BICA_CUENTA_POSITIVA =
  'https://www.bancobica.com.ar/soluciones/cuentaspositivas.aspx'

const NOMBRES_FONDO = [
  'BICA CUENTA POSITIVA 1',
  'BICA CUENTA POSITIVA 2',
  'BICA CUENTA POSITIVA 3',
  'BICA CUENTA POSITIVA 4',
]

function parsearMontoArgentino(texto) {
  const coincidencias = String(texto || '').match(/\$[\d.]+/g)

  if (!coincidencias?.length) {
    return null
  }

  return Number(
    coincidencias[coincidencias.length - 1].replace('$', '').replace(/\./g, ''),
  )
}

function parsearTopeDesdeRango(rango) {
  const limpio = (rango || '').toLowerCase().trim()

  if (limpio.startsWith('desde')) {
    return null
  }

  const coincidenciaHasta = limpio.match(/hasta\s+(\$[\d.]+)/i)

  if (coincidenciaHasta?.[1]) {
    return parsearMontoArgentino(coincidenciaHasta[1])
  }

  return null
}

function parsearTnaDesdeTexto(texto) {
  const coincidencia = String(texto || '').match(/(\d+(?:[.,]\d+)?)\s*%/)

  if (!coincidencia?.[1]) {
    return null
  }

  return porcentajeADecimal(
    Number(coincidencia[1].replace(',', '.')),
  )
}

export function parsearNivelesCuentaPositivaBica(html) {
  const $ = load(html)
  const contenedor = $('#C\\+1')

  if (!contenedor.length) {
    throw new Error('No se encontró la sección C+1 de Cuenta Positiva en Banco Bica')
  }

  const celdas = contenedor
    .find('[style*="grid-template-columns"]')
    .children()
    .toArray()
    .map(elemento => $(elemento).text().replace(/\s+/g, ' ').trim())

  if (celdas.length < 10) {
    throw new Error('La tabla de tasas de Banco Bica no tiene el formato esperado')
  }

  const niveles = []

  for (let indice = 0; indice < 4; indice += 1) {
    const offset = 2 + indice * 2
    const tnaTexto = celdas[offset]
    const rango = celdas[offset + 1]
    const tna = parsearTnaDesdeTexto(tnaTexto)

    if (tna === null) {
      throw new Error(`No se pudo interpretar la TNA del nivel ${indice + 1} de Banco Bica`)
    }

    niveles.push({
      fondo: NOMBRES_FONDO[indice],
      tna: redondearTasa(tna),
      tope: parsearTopeDesdeRango(rango),
      condiciones: `Cuenta Positiva de Banco Bica: ${rango}`,
      condicionesCorto: rango,
    })
  }

  return niveles
}

export async function extraerBicaCuentaPositiva() {
  const log = logGrupo({
    fuente: 'extraerBica',
    tipo: 'cuentaPositiva',
  })

  try {
    const respuesta = await fetch(URL_BICA_CUENTA_POSITIVA)

    if (!respuesta.ok) {
      throw new Error(
        `Error al obtener la página de Banco Bica: ${respuesta.statusText}`,
      )
    }

    const niveles = parsearNivelesCuentaPositivaBica(await respuesta.text())
    const fecha = format(new Date(), 'yyyy-MM-dd')

    logMensaje(log, 'Extracción de Banco Bica exitosa', {
      niveles: niveles.length,
    })

    return niveles.map(nivel => ({
      ...nivel,
      tea: calcularTeaDesdeTna(nivel.tna),
      fecha,
    }))
  } catch (error) {
    logError(log, error)
    return []
  }
}

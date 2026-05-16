import { load } from 'cheerio'
import { descargarImagen, normalizarNombre } from '@/utils/imagenes.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerPresidentes',
  tipo: 'extraccion',
})

const MESES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

function limpiarTexto(texto) {
  return texto
    .replace(/\[.*?\]/g, '')
    .replace(/\u200b/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function parsearFecha(texto) {
  if (!texto) return null

  const limpio = limpiarTexto(texto)

  if (
    !limpio ||
    limpio === '–' ||
    limpio === '-' ||
    limpio === 'en funciones' ||
    limpio === 'actualidad'
  )
    return null

  // Formato: "10 de diciembre de 2019"
  const partes = limpio.split(' de ')

  if (partes.length < 3) return null

  const dia = Number(partes[0].trim())
  const mes = partes[1].trim()

  const año = Number(partes[2].trim().split(' ')[0])

  const mesNum = MESES[mes]

  if (!mesNum || !dia || !año || dia < 1 || dia > 31 || año < 1800) return null

  return new Date(Date.UTC(año, mesNum - 1, dia)).toISOString().split('T')[0]
}

export async function extraerPresidentes() {
  try {
    const url =
      'https://es.wikipedia.org/wiki/Anexo:Presidentes_de_la_Naci%C3%B3n_Argentina'

    const respuesta = await fetch(url)
    const html = await respuesta.text()
    const $ = load(html)

    const presidentes = []
    const celdasPendientes = []

    $('table.wikitable tr').each((iFila, fila) => {
      const $fila = $(fila)

      // Omitir filas de encabezado de sección que tienen un solo th que ocupa toda la tabla
      if (
        $fila.find('th').length === 1 &&
        $fila.find('th').attr('colspan') === '13'
      )
        return

      if ($fila.find('th').length > 1) return

      const celdas = []
      let indiceCeldaOriginal = 0
      const $tds = $fila.find('td')

      // 1. Reconstruir la fila virtual teniendo en cuenta celdas con rowspan de filas anteriores
      for (let j = 0; j < 13; j++) {
        const pendiente = celdasPendientes.find(
          p => p.columna === j && p.filasRestantes > 0,
        )

        if (pendiente) {
          celdas[j] = pendiente.contenido
          pendiente.filasRestantes--
        } else if (indiceCeldaOriginal < $tds.length) {
          const $td = $($tds[indiceCeldaOriginal])
          const rowspan = Number($td.attr('rowspan') || 1)
          const colspan = Number($td.attr('colspan') || 1)
          const contenido = $td

          for (let c = 0; c < colspan; c++) {
            celdas[j + c] = contenido

            if (rowspan > 1) {
              celdasPendientes.push({
                columna: j + c,
                filasRestantes: rowspan - 1,
                contenido: contenido,
              })
            }
          }

          indiceCeldaOriginal++
          j += colspan - 1
        }
      }

      // 2. Extraer datos de las celdas virtuales
      // Columna 1: Imagen del presidente (índice 1)
      const $celdaImagenPresidente = celdas[1]

      const $imgPresidente = $celdaImagenPresidente
        ? $celdaImagenPresidente.find('img')
        : null

      let urlImagenPresidente = $imgPresidente
        ? $imgPresidente.attr('src')
        : null

      if (urlImagenPresidente && urlImagenPresidente.startsWith('//')) {
        urlImagenPresidente = `https:${urlImagenPresidente}`
      }

      // Columna 2: Nombre (índice 2)
      const $celdaNombre = celdas[2]

      if (!$celdaNombre) return

      const $enlacesNombre = $celdaNombre.find('a')

      if (!$enlacesNombre.length) return

      const nombre = limpiarTexto($($enlacesNombre[0]).text())

      if (!nombre) return

      // Columna 4: Periodo Presidencial (índice 4)
      const periodoPresidencial =
        limpiarTexto(celdas[4] ? celdas[4].text() : '') || null

      // Columna 5: Inicio (índice 5)
      const inicio = parsearFecha(celdas[5] ? celdas[5].text() : null)

      // Columna 6: Fin (índice 6)
      const fin = parsearFecha(celdas[6] ? celdas[6].text() : null)

      // Columna 8: Partido (índice 8)
      const $celdaPartido = celdas[8]
      const $enlacesPartido = $celdaPartido ? $celdaPartido.find('a') : null

      const partido =
        $enlacesPartido && $enlacesPartido.length
          ? limpiarTexto(
              $($enlacesPartido[$enlacesPartido.length - 1]).text(),
            ) || null
          : null

      const $imgPartido = $celdaPartido ? $celdaPartido.find('img') : null
      let urlImagenPartido = $imgPartido ? $imgPartido.attr('src') : null

      if (urlImagenPartido && urlImagenPartido.startsWith('//')) {
        urlImagenPartido = `https:${urlImagenPartido}`
      }

      // Columna 10-11-12: Vicepresidente (índice 10 en adelante)
      const $celdaVice = celdas[11] || celdas[12]
      const vicepresidente = $celdaVice ? limpiarTexto($celdaVice.text()) : null

      presidentes.push({
        nombre,
        inicio,
        fin,
        partido,
        periodoPresidencial,
        vicepresidente,
        imagen: urlImagenPresidente,
        partidoImagen: urlImagenPartido,
      })
    })

    for (const presidente of presidentes) {
      if (presidente.imagen) {
        presidente.imagen = await descargarImagen(
          presidente.imagen,
          'presidentes',
          normalizarNombre(presidente.nombre),
        )
      }

      if (presidente.partidoImagen) {
        presidente.partidoImagen = await descargarImagen(
          presidente.partidoImagen,
          'partidos',
          normalizarNombre(presidente.partido || 'independiente'),
        )
      }
    }

    return presidentes
  } catch (error) {
    logError(log, error)
    throw error
  }
}

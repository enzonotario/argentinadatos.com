import axios from 'axios'
import { format, parse } from 'date-fns'
import { interpretarDecimalConComa } from '@/utils/numeros.js'
import { logGrupo, logError } from '@/log.js'

const mapeoSerie = {
  mercadoDinero: '4',
  rentaVariable: '2',
  rentaFija: '3',
  rentaMixta: '5',
  retornoTotal: '7',
}

function decodificar(texto) {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function extraerItemsDeHtml(html) {
  const items = []
  var m

  const re = new RegExp(
    '<tr>\\s*<td>(?!<\\/td>)(.*?)<\\/td>\\s*<td>(.*?)<\\/td>\\s*<td[^>]*>(.*?)<\\/td>\\s*<td[^>]*>(.*?)<\\/td>\\s*<td[^>]*>(.*?)<\\/td>\\s*<td[^>]*>(.*?)<\\/td>\\s*<\\/tr>',
    'gi',
  )

  while ((m = re.exec(html)) !== null) {
    const fondo = decodificar(m[1])
    const horizonteTexto = decodificar(m[2])

    if (!fondo || !horizonteTexto) continue

    const fechaTexto = decodificar(m[3])
    const vcpTexto = decodificar(m[4])
    const ccpTexto = decodificar(m[5])
    const patrimonioTexto = decodificar(m[6])

    items.push({
      fondo,
      horizonte: interpretarHorizonte(horizonteTexto),
      fecha: fechaTexto
        ? format(parse(fechaTexto, 'dd/MM/yy', new Date()), 'yyyy-MM-dd')
        : null,
      vcp: vcpTexto ? interpretarDecimalConComa(vcpTexto) : null,
      ccp: ccpTexto ? interpretarDecimalConComa(ccpTexto) : null,
      patrimonio: patrimonioTexto
        ? interpretarDecimalConComa(patrimonioTexto)
        : null,
    })
  }

  return items
}

export async function extraerCafci(serie) {
  const url = `https://estadisticas.cafci.org.ar/estadisticas/informacion-diaria?tipo_renta=${mapeoSerie[serie]}`

  const log = logGrupo({
    fuente: 'cafci',
    serie,
    url,
  })

  try {
    const respuesta = await axios.get(url)

    const inicioTabla = respuesta.data.indexOf('<div id="scrollTable">')
    const finTabla = respuesta.data.indexOf('<div id="tool"', inicioTabla)
    const htmlTabla = respuesta.data.slice(inicioTabla, finTabla)

    return extraerItemsDeHtml(htmlTabla)
  } catch (error) {
    logError(log, error)
    return []
  }
}

function interpretarHorizonte(horizonte) {
  if (horizonte === 'COR') return 'corto'

  if (horizonte === 'MED') return 'medio'

  if (horizonte === 'LAR') return 'largo'

  if (horizonte === 'FLEX') return 'flex'

  return horizonte
}

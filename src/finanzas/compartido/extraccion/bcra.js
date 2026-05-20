import axios from 'axios'
import { logGrupo, logError } from '@/log.js'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

const log = logGrupo({
  fuente: 'bcra.extractor',
  tipo: 'extraccion',
})

export async function extraerBcra(serie, desde, hasta) {
  const intentos = 3

  for (var intento = 0; intento < intentos; intento++) {
    try {
      const respuesta = await obtenerRespuesta(serie, desde, hasta)

      return respuesta
    } catch (error) {
      logError(log, error)
    }

    await new Promise(resuelve => {
      setTimeout(resuelve, 700)
    })
  }

  throw new Error(
    `No se pudo extraer los datos del BCRA para la serie ${serie}`,
  )
}

async function obtenerRespuesta(serie, desde, hasta) {
  const url =
    'http://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables_datos.asp'

  const respuesta = await fetch(url, {
    method: 'POST',
    body: new URLSearchParams({
      fecha_desde: desde,
      fecha_hasta: hasta,
      primeravez: '1',
      serie: serie,
    }),
  })

  return respuesta.text()
}

export async function extraerBcraApi(serie, desde, hasta) {
  const intentos = 3

  for (var intento = 0; intento < intentos; intento++) {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${serie}?desde=${desde}&hasta=${hasta}`

    try {
      const respuesta = await axios.get(url)

      // console.log(respuesta.data.results[0].detalle)
      // return respuesta.data.results
      const respuestaSerie = respuesta.data.results.find(
        r => r.idVariable === serie,
      )

      if (!respuestaSerie) {
        throw new Error(
          `No se encontró la serie ${serie} en la respuesta del BCRA API`,
        )
      }

      return respuestaSerie.detalle
    } catch (error) {
      logError(log, error)
    }

    await new Promise(resuelve => {
      setTimeout(resuelve, 700)
    })
  }

  throw new Error(
    `No se pudo extraer los datos del BCRA para la serie ${serie}`,
  )
}

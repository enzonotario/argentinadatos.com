import { load } from 'cheerio'
import { format } from 'date-fns'
import axios from 'axios'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerDecrypto',
  tipo: 'rendimientos',
})

export async function extraerDecrypto() {
  try {
    const respuesta = await axios.get(
      import.meta.env.VITE_FINANZAS_RENDIMIENTOS_DECRYPTO_URL,
      {
        headers: {
          Accept: 'application/xml, text/xml, */*',
        },
      },
    )

    if (!respuesta.data) {
      return []
    }

    const $ = load(respuesta.data, {
      xmlMode: true,
    })

    const items = []
    const fecha = format(new Date(), 'yyyy-MM-dd')

    $('data > moneda')
      .parent()
      .each((_, elemento) => {
        const simbolo = $(elemento).find('simbolo').text().trim()

        const porcentaje = $(elemento).find('porcentaje').text().trim()

        if (simbolo && porcentaje) {
          const moneda = simbolo.toUpperCase()
          const apy = Number(porcentaje)

          items.push({
            moneda,
            apy,
            fecha,
          })
        }
      })

    return items
  } catch (error) {
    logError(log, error)
    return []
  }
}

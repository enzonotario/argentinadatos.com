import { logMensaje } from '@/log.js'
import { scrapeHtmlWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeHtmlWithFirecrawl.js'
import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'

const FUENTES_GLOBAL66_REMESAS = [
  {
    nombre: 'tarjeta',
    url: 'https://www.global66.com/ar/tarjeta/',
  },
  {
    nombre: 'iban',
    url: 'https://www.global66.com/ar/iban/',
  },
  {
    nombre: 'viajeros',
    url: 'https://www.global66.com/ar/viajeros/',
  },
  {
    nombre: 'freelancers',
    url: 'https://www.global66.com/ar/freelancers/',
  },
  {
    nombre: 'recibir',
    url: 'https://ayuda.global66.com/docs/primeros-pasos/recibe-dinero-directamente-a-tu-cuenta-en-usd-eur-y-gbp-con-global66/',
  },
]

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

/**
 * Cuenta propia según /ar/freelancers/: datos bancarios USA/Europa a tu nombre.
 * @param {string} texto
 * @returns {boolean}
 */
export function detectarCuentaPropiaGlobal66(texto) {
  const t = String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  const aTuNombre = /a tu nombre/.test(t)
  const datosUsa =
    /routing number/.test(t) ||
    /account number/.test(t) ||
    /numero de cuenta/.test(t)
  const datosEuropa = /\biban\b/.test(t)

  return aTuNombre && (datosUsa || datosEuropa)
}

export function mapearGlobal66Remesas(texto) {
  exigir(texto, 'recargos por moneda extranjera')
  exigir(texto, 'tarjeta digital y global')
  exigir(texto, 'ACH son gratuitas')
  exigir(texto, '$10 USD')
  exigir(texto, 'al menos una compra al mes')
  exigir(texto, 'exclusivamente en formato virtual')
  exigir(texto, 'sin cargos ocultos por compras internacionales')
  exigir(texto, 'tipo Checking')
  exigir(texto, 'sin costos de mantención')
  exigir(texto, 'Recepción gratuita')
  exigir(texto, 'rendimiento de hasta 6%')
  // /ar/freelancers/: señal canónica de cuenta a nombre del usuario.
  exigir(texto, 'a tu nombre')
  exigir(texto, 'Routing Number')
  exigir(texto, 'Account Number')

  const cuentaPropia = detectarCuentaPropiaGlobal66(texto)
  if (!cuentaPropia) {
    throw new Error(
      'Global66 freelancers: no se pudo confirmar cuenta a tu nombre',
    )
  }

  return normalizarRemesa({
    compania: 'Global66',
    cuentaPropia,
    moneda: 'FIAT',
    inversiones: true,
    tarjetaUsa: true,
    costoRecibirPagos: '0',
    costoMantenimientoTarjeta: '0 si hay 1 compra al mes',
    costoTarjeta: '0',
    retiroArs: null,
    detalles: {
      cuentaPropia:
        'En global66.com/ar/freelancers/ dicen que dan datos bancarios locales a tu nombre: Routing Number y Account Number (USA) e IBAN (Europa).',
      costoRecibirPagos:
        'ACH gratis. Wire y SWIFT tienen un costo fijo de recepción de 10 USD.',
      costoMantenimientoTarjeta:
        'La Smart Card no tiene mantenimiento si hay al menos una compra al mes. En Argentina es solo virtual. La cuenta no tiene costo de mantención.',
      costoTarjeta:
        'Sin recargo por moneda extranjera y sin cargos ocultos en compras internacionales.',
      retiroArs:
        'No publican un costo fijo para convertir el saldo a pesos. La cuenta en USD no permite retiros en efectivo.',
      tarjetaUsa:
        'La Smart Card es una tarjeta digital y global para pagar en dólares. En Argentina es solo virtual. Una tarjeta global cuenta como tarjeta de EE.UU.',
      inversiones:
        'El centro de ayuda, que incluye a personas en Argentina, dice que la cuenta en dólares mantiene un rendimiento de hasta 6% anual.',
    },
  })
}

export async function extraerGlobal66Remesas(log) {
  const textos = await Promise.all(
    FUENTES_GLOBAL66_REMESAS.map(async (fuente) => {
      logMensaje(log, `Fuente oficial: global66 ${fuente.nombre}`, {
        url: fuente.url,
      })

      const { markdown } = await scrapeHtmlWithFirecrawl(log, fuente.url)

      if (!markdown.trim()) {
        throw new Error(`Fuente oficial vacía: ${fuente.url}`)
      }

      return markdown
    }),
  )

  return mapearGlobal66Remesas(textos.join('\n'))
}

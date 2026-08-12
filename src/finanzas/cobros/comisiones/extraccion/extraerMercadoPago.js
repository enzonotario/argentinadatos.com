import { logGrupo, logError, logMensaje } from '@/log.js'
import {
  crearComisionCobro,
  inferirAcreditacionTipo,
  parseArancelTexto,
  parsePlazoHabilesDesdeLabel,
} from '@/finanzas/cobros/comisiones/extraccion/parseArancel.js'
import { requestFirecrawl } from '@/shared/extraction/firecrawl/firecrawlClient.js'

const log = logGrupo({
  fuente: 'extraerMercadoPagoComisionesCobro',
  tipo: 'extraccion',
})

export const MERCADOPAGO_FUENTES = [
  {
    key: 'point',
    canal: 'pos',
    productoPrefijo: 'Point',
    url: 'https://www.mercadopago.com.ar/ayuda/2779',
  },
  {
    key: 'qr',
    canal: 'qr',
    productoPrefijo: 'QR',
    url: 'https://www.mercadopago.com.ar/ayuda/3605',
  },
  {
    key: 'link',
    canal: 'link',
    productoPrefijo: 'Link de pago',
    url: 'https://www.mercadopago.com.ar/ayuda/33392',
  },
  {
    key: 'checkout',
    canal: 'checkout',
    productoPrefijo: 'Checkout',
    url: 'https://www.mercadopago.com.ar/ayuda/33399',
  },
]

/** Grupo provincial de referencia v1 (primera tabla publicada). */
export const MERCADOPAGO_GRUPO_DEFAULT = 'Buenos Aires'

/**
 * @param {string} medioTexto
 * @returns {{ medioPago: string, producto: string }}
 */
export function mapearMedioMercadoPago(medioTexto) {
  const texto = String(medioTexto || '')
    .replace(/\\?\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const lower = texto.toLowerCase()

  if (/dinero en cuenta|saldo/.test(lower)) {
    return { medioPago: 'qr_cuenta', producto: 'Dinero en cuenta' }
  }

  if (/prepaga/.test(lower)) {
    return { medioPago: 'prepaga', producto: 'Tarjeta prepaga' }
  }

  if (/d[eé]bito/.test(lower)) {
    return { medioPago: 'debito', producto: 'Tarjeta de débito' }
  }

  if (/cr[eé]dito/.test(lower) && /cuotas/.test(lower)) {
    return { medioPago: 'credito_cuotas', producto: 'Crédito en cuotas' }
  }

  if (/cr[eé]dito/.test(lower)) {
    return { medioPago: 'credito', producto: 'Tarjeta de crédito' }
  }

  if (/todos los medios/.test(lower)) {
    return { medioPago: 'otro', producto: 'Todos los medios de pago' }
  }

  if (/cuotas sin tarjeta/.test(lower)) {
    return { medioPago: 'otro', producto: 'Cuotas sin Tarjeta' }
  }

  if (/pix/.test(lower)) {
    return { medioPago: 'otro', producto: 'Pix' }
  }

  return { medioPago: 'otro', producto: texto || 'Otro' }
}

/**
 * Extrae la primera tabla de costos del grupo provincial de referencia.
 * @param {string} markdown
 * @returns {{ grupoProvincial: string|null, filas: Array<{ medio: string, arancelTexto: string, plazoLabel: string }> }}
 */
export function extraerTablaGrupoDefault(markdown) {
  const texto = String(markdown || '')

  const grupos = [
    ...texto.matchAll(/\*\*([^*]+):\*\*\s*\n\n((?:\|[^\n]+\n)+)/g),
  ]

  if (!grupos.length) {
    return { grupoProvincial: null, filas: [] }
  }

  const preferido =
    grupos.find(([, titulo]) => titulo.includes(MERCADOPAGO_GRUPO_DEFAULT)) ||
    grupos[0]

  const [, titulo, tabla] = preferido
  const grupoProvincial = titulo.replace(/\\\|/g, '|').trim()

  /** @type {Array<{ medio: string, arancelTexto: string, plazoLabel: string }>} */
  const filas = []
  let medioActual = ''

  for (const linea of tabla.split('\n')) {
    if (!linea.startsWith('|')) continue
    if (/^\|\s*-+/.test(linea)) continue
    if (/Si te pagan con/i.test(linea)) continue

    const celdas = linea
      .split('|')
      .slice(1, -1)
      .map(c => c.replace(/\\\|/g, '|').replace(/\s+/g, ' ').trim())

    if (!celdas.length) continue

    let medio = ''
    let arancelTexto = ''
    let plazoLabel = ''

    if (celdas.length >= 3) {
      ;[medio, arancelTexto, plazoLabel] = celdas
    } else if (celdas.length === 2 && /%/.test(celdas[0])) {
      ;[arancelTexto, plazoLabel] = celdas
    } else {
      continue
    }

    if (medio) {
      medioActual = medio
    }

    if (!medioActual || !arancelTexto) continue

    filas.push({
      medio: medioActual,
      arancelTexto,
      plazoLabel,
    })
  }

  return { grupoProvincial, filas }
}

/**
 * @param {string} markdown
 * @param {{ canal: string, productoPrefijo: string, url: string }} opts
 * @returns {Array<object>}
 */
export function parsearMercadoPagoMarkdown(markdown, opts) {
  const { grupoProvincial, filas } = extraerTablaGrupoDefault(markdown)

  if (!filas.length) {
    return []
  }

  const ivaAdicional = /no incluyen IVA/i.test(markdown)

  return filas.map(fila => {
    const medio = mapearMedioMercadoPago(fila.medio)
    const parsed = parseArancelTexto(fila.arancelTexto)
    const acreditacionTipo = inferirAcreditacionTipo(fila.plazoLabel)
    const acreditacionPlazoHabiles = parsePlazoHabilesDesdeLabel(
      fila.plazoLabel,
    )

    return crearComisionCobro({
      entidad: 'mercadopago',
      nombreComercial: 'Mercado Pago',
      producto: `${opts.productoPrefijo} — ${medio.producto}`,
      canal: opts.canal,
      medioPago: medio.medioPago,
      arancel: parsed.arancel,
      arancelEsTope: false,
      incluyeIva: false,
      ivaAdicional: ivaAdicional || parsed.ivaAdicional,
      acreditacionTipo,
      acreditacionPlazoHabiles,
      acreditacionLabel: fila.plazoLabel || null,
      condiciones:
        'Costos según provincia de domicilio fiscal; v1 usa el primer grupo publicado (referencia BA). No incluyen IVA ni retenciones.',
      enlace: opts.url,
      metadata: {
        fuenteUrl: opts.url,
        grupoProvincial,
        medioOriginal: fila.medio,
      },
    })
  })
}

async function obtenerMarkdownFuente(url) {
  const response = await requestFirecrawl({
    url,
    onlyMainContent: true,
    maxAge: 0,
    formats: ['markdown'],
  })

  if (!response.ok) {
    throw new Error(
      `Firecrawl markdown falló: ${response.status} ${response.statusText} (${url})`,
    )
  }

  const payload = await response.json()

  if (!payload.success || !payload.data?.markdown) {
    throw new Error(`Firecrawl sin markdown para ${url}`)
  }

  return payload.data.markdown
}

export async function extraerMercadoPago() {
  try {
    const resultados = await Promise.allSettled(
      MERCADOPAGO_FUENTES.map(async fuente => {
        const markdown = await obtenerMarkdownFuente(fuente.url)
        return parsearMercadoPagoMarkdown(markdown, fuente)
      }),
    )

    /** @type {Array<object>} */
    const comisiones = []

    for (let i = 0; i < resultados.length; i += 1) {
      const resultado = resultados[i]
      const fuente = MERCADOPAGO_FUENTES[i]

      if (resultado.status === 'fulfilled') {
        comisiones.push(...resultado.value)
        logMensaje(log, `Mercado Pago ${fuente.key} parseado`, {
          filas: resultado.value.length,
        })
      } else {
        logError(log, resultado.reason)
        logMensaje(log, `Mercado Pago ${fuente.key} falló`, {
          errorMessage: resultado.reason?.message,
        })
      }
    }

    return comisiones
  } catch (error) {
    logError(log, error)
    return []
  }
}

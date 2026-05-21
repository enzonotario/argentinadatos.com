function _nullishCoalesce(lhs, rhsFn) {
  if (lhs != null) {
    return lhs
  } else {
    return rhsFn()
  }
}

import { scrapearConFirecrawl } from '@/finanzas/compartido/extraccion/scrapearConFirecrawl.js'
import { logMensaje, logError, logGrupo } from '@/log.js'

export const DOCTA_BONOS_CER_URL =
  'https://app.doctacapital.com.ar/dashboard/bonos/general/soberanos/cer'

function parseNumeroFlexible(valor) {
  if (valor === null || valor === undefined) return null

  if (typeof valor === 'number' && !isNaN(valor)) return valor

  let s = String(valor).trim().replace(/\$/g, '').replace(/\s/g, '')

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  }

  const n = parseFloat(s)

  return !isNaN(n) ? n : null
}

/** DD/MM/YYYY o DD-MM-YYYY → yyyy-MM-dd */
function vencimientoDmaAIso(dma) {
  if (!dma || typeof dma !== 'string') return null

  const partes = dma
    .trim()
    .split(/[\/\-]/)
    .map(p => p.trim())

  if (partes.length !== 3) return null

  const dd = parseInt(partes[0])
  const mm = parseInt(partes[1])
  const yyyy = parseInt(partes[2])

  if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null

  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** Instante en UTC (offset 0), ISO 8601 con sufijo `Z` (equiv. `Date#toISOString()`). */
function fechaActualizacionUtc0() {
  return new Date().toISOString()
}

function limpiarTicker(raw) {
  let s = String(_nullishCoalesce(raw, () => ''))
    .trim()
    .toUpperCase()

  s = s.replace(/\s+24HS$/i, '').trim()
  return s
}

/** Tabla Soberano CER en Docta (Firecrawl JSON extract → filas del endpoint). */
async function extraerFilasBonosCerDocta(log) {
  const configuracion = {
    url: DOCTA_BONOS_CER_URL,
    prompt: `Estás en la página de cotización de bonos soberanos ajustados por CER de Docta Capital.
Extraé **todas las filas visibles** de la tabla principal (no solo las primeras): ticker, precio en pesos, TIR en porcentaje, fecha de vencimiento y volumen nominal si figura.

Reglas:
- ticker: código del bono (ej. TZX26, TX26, X13Y6). Sin texto extra tipo "24hs".
- precioArs: número decimal del precio cotización (ej. 107.29 para "$107,29").
- tirPorcentaje: número sin símbolo % (ej. 29.76 para "29,76%").
- vencimientoDma: fecha exactamente en formato DD/MM/YYYY como en la columna Vto.
- volumenNominal: si hay columna de volumen en nominales, número sin separadores de miles; si no hay dato, omití la propiedad.`,
    schema: {
      bonos: {
        type: 'array',
        description: 'Filas de la grilla soberanos CER',
        items: {
          type: 'object',
          properties: {
            ticker: {
              type: 'string',
              description: 'Código del bono',
            },
            precioArs: {
              type: 'number',
              description: 'Precio cotización en ARS (decimal)',
            },
            tirPorcentaje: {
              type: 'number',
              description: 'TIR en % sin signo porcentaje',
            },
            vencimientoDma: {
              type: 'string',
              description: 'Vencimiento DD/MM/AAAA',
            },
            volumenNominal: {
              type: 'number',
              description: 'Volumen nominal opcional',
            },
          },
          required: ['ticker', 'precioArs', 'tirPorcentaje', 'vencimientoDma'],
        },
      },
    },
    required: ['bonos'],
  }

  logMensaje(log, 'Firecrawl: Docta Capital soberanos CER', {
    url: DOCTA_BONOS_CER_URL,
  })

  const datos = await scrapearConFirecrawl(log, configuracion)

  if (!datos || !Array.isArray(datos.bonos)) {
    throw new Error('Firecrawl Docta: respuesta sin array bonos')
  }

  const resultado = []

  for (const raw of datos.bonos) {
    const symbol = limpiarTicker(raw.ticker)

    if (!symbol || symbol.length < 3) continue

    const precio = _nullishCoalesce(parseNumeroFlexible(raw.precioArs), () =>
      parseNumeroFlexible(raw.precio),
    )

    const tir = _nullishCoalesce(parseNumeroFlexible(raw.tirPorcentaje), () =>
      parseNumeroFlexible(raw.tirReal),
    )

    if (precio === null || precio <= 0) continue

    if (tir === null || isNaN(tir)) continue

    const maturity = vencimientoDmaAIso(raw.vencimientoDma || raw.vto || '')

    if (!maturity) continue

    let vol = raw.volumenNominal

    if (vol !== null && typeof vol !== 'number') vol = parseNumeroFlexible(vol)

    resultado.push({
      ticker: symbol,
      precioArs: Math.round(precio * 100) / 100,
      tirPorcentaje: Math.round(tir * 100) / 100,
      fechaVencimiento: maturity,
      volumen: vol !== null && !isNaN(vol) ? vol : undefined,
    })
  }

  if (resultado.length === 0) {
    throw new Error(
      'Firecrawl Docta: no quedaron filas válidas tras normalizar',
    )
  }

  resultado.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))

  logMensaje(log, 'Docta CER: filas normalizadas', {
    cantidad: resultado.length,
    muestra: resultado
      .slice(0, Math.min(5, resultado.length))
      .map(r => r.ticker),
  })

  return resultado
}

export async function extraerBonosCer() {
  const log = logGrupo({
    fuente: 'extraerBonosCer',
    tipo: 'bonosCer',
  })

  try {
    const bonos = await extraerFilasBonosCerDocta(log)

    return {
      fechaActualizacion: fechaActualizacionUtc0(),
      bonos,
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'extraerBonosCer: falló Docta/Firecrawl', {
      errorMessage: error.message,
    })
    return {
      fechaActualizacion: fechaActualizacionUtc0(),
      bonos: [],
      errorExtraccion: error.message,
    }
  }
}

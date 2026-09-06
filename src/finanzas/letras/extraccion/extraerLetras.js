function _nullishCoalesce(lhs, rhsFn) {
  if (lhs != null) {
    return lhs
  } else {
    return rhsFn()
  }
}

import { scrapeWithFirecrawl } from '@/shared/extraction/firecrawl/scrapeWithFirecrawl.js'
import { logMensaje, logError, logGrupo } from '@/log.js'

export const DOCTA_LETRAS_URL =
  'https://app.docta.com.ar/dashboard/bonos/general/soberanos/fixed-rate'

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

  s = s.replace(/\s*-\s*24HS$/i, '').replace(/\s+24HS$/i, '').trim()
  return s
}

function redondear2(n) {
  return Math.round(n * 100) / 100
}

/** Tabla Soberanos tasa fija (LECAP/BONCAP) en Docta (Firecrawl JSON extract → filas del endpoint). */
async function extraerFilasLetrasDocta(log) {
  const configuracion = {
    url: DOCTA_LETRAS_URL,
    prompt: `Estás en la página de cotización de LECAPs / bonos soberanos a tasa fija de Docta.
Extraé **todas las filas visibles** de la tabla principal (no solo las primeras): ticker, precio en pesos, TNA, TEA, TEM, fecha de vencimiento, días al vencimiento, paridad y volumen nominal si figuran.

Reglas:
- ticker: código del instrumento (ej. S15S6, TTS26, T30A7). Sin texto extra tipo "24hs" ni "- 24hs".
- precioArs: número decimal del precio cotización (ej. 106.68 para "ARS 106,68" o "$106,68").
- tnaPorcentaje: TNA sin símbolo % (ej. 32.5 para "32,50%").
- teaPorcentaje: TEA sin símbolo %.
- temPorcentaje: TEM sin símbolo %.
- vencimientoDma: fecha exactamente en formato DD/MM/YYYY como en la columna Vto.
- diasAlVencimiento: entero de la columna D. al Vto. si figura.
- paridadPorcentaje: paridad sin símbolo % (ej. 100.02 para "100,02%"); si no hay dato, omití.
- volumenNominal: volumen en nominales, número sin separadores de miles; si no hay dato, omití.`,
    schema: {
      letras: {
        type: 'array',
        description: 'Filas de la grilla soberanos tasa fija (LECAP/BONCAP)',
        items: {
          type: 'object',
          properties: {
            ticker: {
              type: 'string',
              description: 'Código del instrumento',
            },
            precioArs: {
              type: 'number',
              description: 'Precio cotización en ARS (decimal)',
            },
            tnaPorcentaje: {
              type: 'number',
              description: 'TNA en % sin signo porcentaje',
            },
            teaPorcentaje: {
              type: 'number',
              description: 'TEA en % sin signo porcentaje',
            },
            temPorcentaje: {
              type: 'number',
              description: 'TEM en % sin signo porcentaje',
            },
            vencimientoDma: {
              type: 'string',
              description: 'Vencimiento DD/MM/AAAA',
            },
            diasAlVencimiento: {
              type: 'number',
              description: 'Días al vencimiento (opcional)',
            },
            paridadPorcentaje: {
              type: 'number',
              description: 'Paridad en % sin signo (opcional)',
            },
            volumenNominal: {
              type: 'number',
              description: 'Volumen nominal opcional',
            },
          },
          required: [
            'ticker',
            'precioArs',
            'tnaPorcentaje',
            'teaPorcentaje',
            'temPorcentaje',
            'vencimientoDma',
          ],
        },
      },
    },
    required: ['letras'],
  }

  logMensaje(log, 'Firecrawl: Docta soberanos tasa fija', {
    url: DOCTA_LETRAS_URL,
  })

  const datos = await scrapeWithFirecrawl(log, configuracion)

  if (!datos || !Array.isArray(datos.letras)) {
    throw new Error('Firecrawl Docta: respuesta sin array letras')
  }

  const resultado = []

  for (const raw of datos.letras) {
    const symbol = limpiarTicker(raw.ticker)

    if (!symbol || symbol.length < 3) continue

    const precio = _nullishCoalesce(parseNumeroFlexible(raw.precioArs), () =>
      parseNumeroFlexible(raw.precio),
    )

    const tna = parseNumeroFlexible(raw.tnaPorcentaje)
    const tea = parseNumeroFlexible(raw.teaPorcentaje)
    const tem = parseNumeroFlexible(raw.temPorcentaje)

    if (precio === null || precio <= 0) continue

    if (tna === null || tea === null || tem === null) continue

    const maturity = vencimientoDmaAIso(raw.vencimientoDma || raw.vto || '')

    if (!maturity) continue

    let vol = raw.volumenNominal

    if (vol !== null && typeof vol !== 'number') vol = parseNumeroFlexible(vol)

    let dias = raw.diasAlVencimiento

    if (dias !== null && typeof dias !== 'number')
      dias = parseNumeroFlexible(dias)

    let paridad = raw.paridadPorcentaje

    if (paridad !== null && typeof paridad !== 'number')
      paridad = parseNumeroFlexible(paridad)

    const fila = {
      ticker: symbol,
      precioArs: redondear2(precio),
      tnaPorcentaje: redondear2(tna),
      teaPorcentaje: redondear2(tea),
      temPorcentaje: redondear2(tem),
      fechaVencimiento: maturity,
    }

    if (dias !== null && !isNaN(dias)) fila.diasAlVencimiento = Math.round(dias)

    if (paridad !== null && !isNaN(paridad))
      fila.paridadPorcentaje = redondear2(paridad)

    if (vol !== null && !isNaN(vol)) fila.volumen = vol

    resultado.push(fila)
  }

  if (resultado.length === 0) {
    throw new Error(
      'Firecrawl Docta: no quedaron filas válidas tras normalizar',
    )
  }

  resultado.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))

  logMensaje(log, 'Docta letras: filas normalizadas', {
    cantidad: resultado.length,
    muestra: resultado
      .slice(0, Math.min(5, resultado.length))
      .map(r => r.ticker),
  })

  return resultado
}

export async function extraerLetras() {
  const log = logGrupo({
    fuente: 'extraerLetras',
    tipo: 'letras',
  })

  try {
    const letras = await extraerFilasLetrasDocta(log)

    return {
      fechaActualizacion: fechaActualizacionUtc0(),
      letras,
    }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'extraerLetras: falló Docta/Firecrawl', {
      errorMessage: error.message,
    })
    return {
      fechaActualizacion: fechaActualizacionUtc0(),
      letras: [],
      errorExtraccion: error.message,
    }
  }
}

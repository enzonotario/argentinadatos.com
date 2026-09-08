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

  let s = String(valor)
    .trim()
    .replace(/\$/g, '')
    .replace(/ARS/gi, '')
    .replace(/\s/g, '')

  if (!s || s === '--' || s === '-' || s === '—') return null

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

function limpiarIsin(raw) {
  if (raw === null || raw === undefined) return null

  const s = String(raw).trim().toUpperCase()

  if (!s || s === '--' || s === '-' || s === '—') return null

  return s
}

function limpiarMonedaCupon(raw) {
  if (raw === null || raw === undefined) return null

  const s = String(raw).trim().toUpperCase()

  if (!s || s === '--' || s === '-' || s === '—') return null

  return s
}

function redondear2(n) {
  return Math.round(n * 100) / 100
}

function opcionalNumero(raw) {
  if (raw === null || raw === undefined) return null

  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null

  return parseNumeroFlexible(raw)
}

/** Tabla Soberanos tasa fija (LECAP/BONCAP) en Docta (Firecrawl JSON extract → filas del endpoint). */
async function extraerFilasLetrasDocta(log) {
  const configuracion = {
    url: DOCTA_LETRAS_URL,
    prompt: `Estás en la página de cotización de LECAPs / bonos soberanos a tasa fija de Docta.
Extraé **todas las filas visibles** de la tabla principal (no solo las primeras), con **todas** las columnas disponibles.

Columnas / reglas:
- ticker: código del instrumento (ej. S15S6, TTS26, T30A7). Sin texto extra tipo "24hs" ni "- 24hs".
- precioArs: precio cotización en ARS (ej. 106.74 para "ARS 106,74").
- cierreArs: precio de cierre en ARS (columna Cierre).
- variacionPorcentaje: columna Var. sin símbolo % (ej. 0.06 para "+0,06%" o -0.05 para "-0,05%").
- volumenNominal: columna Volumen (nominales), número sin separadores de miles.
- volumenEfectivoArs: columna Volumen Efectivo en ARS, número sin separadores de miles.
- tnaPorcentaje: TNA sin símbolo %.
- teaPorcentaje: TEA sin símbolo %.
- temPorcentaje: TEM sin símbolo %.
- diasAlVencimiento: entero de D. al Vto.
- vencimientoDma: fecha exactamente DD/MM/YYYY de la columna Vto.
- paridadPorcentaje: Paridad sin símbolo %.
- monedaCupon: columna M. de Cupón (ej. "ARS"); si es "--", omití.
- isin: columna Código ISIN (ej. "AR0227219554"); si es "--" o vacío, omití.`,
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
            cierreArs: {
              type: 'number',
              description: 'Precio de cierre en ARS (decimal)',
            },
            variacionPorcentaje: {
              type: 'number',
              description: 'Variación diaria en % sin signo',
            },
            volumenNominal: {
              type: 'number',
              description: 'Volumen nominal',
            },
            volumenEfectivoArs: {
              type: 'number',
              description: 'Volumen efectivo en ARS',
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
            diasAlVencimiento: {
              type: 'number',
              description: 'Días al vencimiento',
            },
            vencimientoDma: {
              type: 'string',
              description: 'Vencimiento DD/MM/AAAA',
            },
            paridadPorcentaje: {
              type: 'number',
              description: 'Paridad en % sin signo',
            },
            monedaCupon: {
              type: 'string',
              description: 'Moneda de cupón (ej. ARS)',
            },
            isin: {
              type: 'string',
              description: 'Código ISIN',
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

    const cierre = opcionalNumero(raw.cierreArs ?? raw.cierre)
    const variacion = opcionalNumero(raw.variacionPorcentaje)
    const vol = opcionalNumero(raw.volumenNominal ?? raw.volumen)
    const volEfectivo = opcionalNumero(
      raw.volumenEfectivoArs ?? raw.volumenEfectivo,
    )
    const dias = opcionalNumero(raw.diasAlVencimiento)
    const paridad = opcionalNumero(raw.paridadPorcentaje)
    const monedaCupon = limpiarMonedaCupon(raw.monedaCupon)
    const isin = limpiarIsin(raw.isin ?? raw.codigoIsin ?? raw.codigoISIN)

    const fila = {
      ticker: symbol,
      precioArs: redondear2(precio),
      tnaPorcentaje: redondear2(tna),
      teaPorcentaje: redondear2(tea),
      temPorcentaje: redondear2(tem),
      fechaVencimiento: maturity,
    }

    if (cierre !== null) fila.cierreArs = redondear2(cierre)

    if (variacion !== null) fila.variacionPorcentaje = redondear2(variacion)

    if (vol !== null) fila.volumen = vol

    if (volEfectivo !== null) fila.volumenEfectivoArs = volEfectivo

    if (dias !== null) fila.diasAlVencimiento = Math.round(dias)

    if (paridad !== null) fila.paridadPorcentaje = redondear2(paridad)

    if (monedaCupon) fila.monedaCupon = monedaCupon

    if (isin) fila.isin = isin

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

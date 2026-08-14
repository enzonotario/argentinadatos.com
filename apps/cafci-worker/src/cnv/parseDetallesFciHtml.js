import { load } from 'cheerio'

function parseArgentinePercent(text) {
  const cleaned = String(text || '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  if (!cleaned) {
    return null
  }

  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/**
 * Convierte "31/07/26" o "31/07/2026" a YYYY-MM-DD (asume 20xx si año corto).
 */
export function parseCarteraDate(text) {
  const match = String(text || '')
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)

  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = Number(match[2])
  let year = Number(match[3])

  if (year < 100) {
    year += 2000
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function readMetaTable($, tab) {
  const meta = {}

  tab.find('table').first().find('tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 2) {
      return
    }

    const key = $(cells[0]).text().replace(/\s+/g, ' ').trim()
    const value = $(cells[1]).text().replace(/\s+/g, ' ').trim()

    if (key) {
      meta[key] = value
    }
  })

  return meta
}

/**
 * Extrae solo la composición vigente del HTML DetallesFCI (tab #1b).
 * No incluye historial: el datepicker de "carteras anteriores" no se consulta.
 *
 * @returns {{
 *   fondo: string|null,
 *   fecha: string|null,
 *   fechaRaw: string|null,
 *   gerente: string|null,
 *   depositaria: string|null,
 *   tipoRenta: string|null,
 *   moneda: string|null,
 *   region: string|null,
 *   horizonte: string|null,
 *   composicionCartera: Array<{nombre: string, porcentaje: number}>
 * }}
 */
export function parseDetallesFciHtml(html) {
  const $ = load(html || '')
  const tab = $('#1b')

  if (tab.length === 0) {
    return {
      fondo: null,
      fecha: null,
      fechaRaw: null,
      gerente: null,
      depositaria: null,
      tipoRenta: null,
      moneda: null,
      region: null,
      horizonte: null,
      composicionCartera: [],
    }
  }

  const meta = readMetaTable($, tab)
  const fechaRaw = meta['Cartera al (*)'] || meta['Cartera al'] || null

  const compositionTable = tab
    .find('table')
    .filter((_, table) => {
      const headers = $(table)
        .find('thead th')
        .map((__, th) => $(th).text().replace(/\s+/g, ' ').trim().toLowerCase())
        .get()
      return headers.some(header => header.includes('detalle'))
    })
    .first()

  const composicionCartera = []

  compositionTable.find('tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 2) {
      return
    }

    const detailCell = $(cells[0])
    const isLeaf =
      detailCell.find('span').length > 0 ||
      /padding-left/i.test(detailCell.attr('style') || '')

    if (!isLeaf) {
      return
    }

    const nombre = detailCell.text().replace(/\s+/g, ' ').trim()
    const porcentaje = parseArgentinePercent($(cells[1]).text())

    if (!nombre || porcentaje == null) {
      return
    }

    composicionCartera.push({ nombre, porcentaje })
  })

  return {
    fondo: meta.Fondo || null,
    fecha: parseCarteraDate(fechaRaw),
    fechaRaw,
    gerente: meta.Gerente || null,
    depositaria: meta.Depositaria || null,
    tipoRenta: meta['Clasificación'] || meta.Clasificacion || null,
    moneda: meta.Moneda || null,
    region: meta['Región'] || meta.Region || null,
    horizonte: meta.Horizonte || null,
    composicionCartera,
  }
}

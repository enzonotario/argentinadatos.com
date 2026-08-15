import XLSX from 'xlsx'

function parseExcelDate(value) {
  if (value == null || value === '') {
    return null
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) {
      return null
    }

    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }

  const text = String(value).trim()
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)

  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = Number(match[2])
  let year = Number(match[3])

  if (year < 100) {
    year += 2000
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function toNumber(value) {
  if (value == null || value === '' || value === 'N') {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  const normalized = String(value).trim().replace(/%/g, '').replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null
}

function toText(value) {
  if (value == null || value === '') {
    return null
  }

  return String(value).trim() || null
}

function mapTipoRenta(clasificacionCodigo, clasificacionTexto) {
  const code = Number(clasificacionCodigo)

  switch (code) {
    case 1:
      return 'Renta Variable'
    case 2:
      return 'Renta Fija'
    case 3:
      return 'Mercado de Dinero'
    case 4:
      return 'Renta Mixta'
    case 5:
      return 'Retorno Total'
    default:
      break
  }

  const text = toText(clasificacionTexto)?.toLowerCase() || ''

  if (text.includes('mercado') || text === 'ars' || text === 'usd') {
    return 'Mercado de Dinero'
  }

  return clasificacionTexto || null
}

function mapHorizonte(codigo) {
  const code = Number(codigo)

  switch (code) {
    case 1:
      return 'Corto Plazo'
    case 2:
      return 'Mediano Plazo'
    case 3:
      return 'Largo Plazo'
    default:
      return null
  }
}

function mapRegion(codigo) {
  const code = Number(codigo)

  switch (code) {
    case 1:
      return 'Argentina'
    case 2:
      return 'Latinoamérica'
    case 3:
      return 'Global'
    default:
      return null
  }
}

function mapMoneda(codigo, monedaTexto) {
  if (monedaTexto) {
    const upper = String(monedaTexto).toUpperCase()
    if (upper === 'ARS' || upper.includes('PESO')) {
      return 'Peso Argentino'
    }
    if (upper === 'USD' || upper.includes('DOLAR') || upper.includes('DÓLAR')) {
      return 'Dolar Estadounidense'
    }
    return monedaTexto
  }

  const code = Number(codigo)
  if (code === 1) return 'Peso Argentino'
  if (code === 2) return 'Dolar Estadounidense'
  return null
}

/**
 * Parsea la planilla diaria CNV/CAFCI.
 * Las columnas con headers merged se leen por índice fijo observado en producción.
 */
export function parseCnvCuotaparteExcel(buffer, { documentDate } = {}) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
  })
  const sheetName = workbook.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  })

  const headerIdx = rows.findIndex(
    row => Array.isArray(row) && row[0] === 'Fondo',
  )

  if (headerIdx < 0) {
    throw new Error('No se encontró la fila de encabezados en el Excel CNV')
  }

  const funds = []

  for (const row of rows.slice(headerIdx + 1)) {
    if (!Array.isArray(row) || !row[0]) {
      continue
    }

    const fecha = parseExcelDate(row[4])
    const claseId = toText(row[20])
    const valorCuotaparte = toNumber(row[5])
    const valorCuotaparteAnterior = toNumber(row[6])
    const variacionDiariaPct = toNumber(row[7])

    if (!claseId || valorCuotaparte == null) {
      continue
    }

    if (documentDate && fecha && fecha !== documentDate) {
      continue
    }

    funds.push({
      nombre: toText(row[0]),
      clasificacion: toText(row[1]),
      fecha,
      valorCuotaparte,
      valorCuotaparteAnterior,
      variacionDiariaPct,
      // "Variacion cuotaparte %" del Excel: retornos de período (no TNA).
      // Índices fijos: 9 ≈ desde fin de mes previo, 10 YTD, 11 ~12 meses.
      variacionUnMesPct: toNumber(row[9]),
      variacionEnElAnioPct: toNumber(row[10]),
      variacionDoceMesesPct: toNumber(row[11]),
      cantidadCuotapartes: toNumber(row[12]),
      patrimonio: toNumber(row[14]),
      marketShare: toNumber(row[16]),
      depositaria: toText(row[17]),
      codigoCNV: toText(row[18]),
      calificacion: toText(row[19]),
      claseId,
      codigoSociedadGerente: toText(row[21]),
      codigoSociedadDepositaria: toText(row[22]),
      administradora: toText(row[23]),
      codigoClasificacion: toText(row[24]),
      codigoMoneda: toText(row[25]),
      codigoRegion: toText(row[26]),
      codigoHorizonte: toText(row[27]),
      comisionIngreso: toNumber(row[29]),
      honorarioGerente: toNumber(row[30]),
      honorarioDepositaria: toNumber(row[31]),
      gastosOrdinariosGestion: toNumber(row[32]),
      comisionEgreso: toNumber(row[33]),
      comisionTransferencia: toNumber(row[34]),
      comisionExito: toText(row[35]) === 'N' ? null : toNumber(row[35]),
      moneda: mapMoneda(row[25], row[36]),
      plazoLiquidacionDias: toNumber(row[37]),
      fondoIdPadre: toText(row[39]),
      inversionMinima: toNumber(row[43]),
      tipoDD: toText(row[45]),
      tipoRenta: mapTipoRenta(row[24], row[1]),
      horizonte: mapHorizonte(row[27]),
      region: mapRegion(row[26]),
    })
  }

  return {
    sheetName,
    documentDate: documentDate ?? null,
    funds,
  }
}

import { load } from 'cheerio'
import { cafciGet } from '../utils/cafciHttp.js'
import { buildFundSlug } from '../utils/buildFundSlug.js'
import { normalizarPayloadFondo } from '../utils/normalizarPayloadFondo.js'

const cafciBaseUrl = 'https://estadisticas.cafci.org.ar'
const searchPageUrl = `${cafciBaseUrl}/resultado-busqueda`

function parseNumber(text) {
  if (!text) {
    return null
  }

  const normalized = text
    .trim()
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')

  const value = Number(normalized)

  return Number.isNaN(value) ? null : value
}

function parseMixedNumber(text) {
  if (!text) {
    return null
  }

  const normalized = text
    .trim()
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .replace(/\$/g, '')

  if (normalized.includes(',')) {
    const value = Number(normalized.replace(/\./g, '').replace(/,/g, '.'))
    return Number.isNaN(value) ? null : value
  }

  const value = Number(normalized)

  return Number.isNaN(value) ? null : value
}

function parseDate(text) {
  if (!text) {
    return null
  }

  const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)

  if (!match) {
    return null
  }

  return `${match[3]}-${match[2]}-${match[1]}`
}

export async function fetchFundsCatalog() {
  const response = await cafciGet(searchPageUrl)
  const $ = load(response.data)
  const funds = []

  $('#selectClase option').each((_, element) => {
    const value = $(element).attr('value')
    const name = $(element).text().trim()

    if (!value || !name) {
      return
    }

    const [fondoId, claseId] = value.split(';')

    if (!fondoId || !claseId) {
      return
    }

    funds.push({
      fondoId,
      claseId,
      nombre: name,
      slug: buildFundSlug({ nombre: name, fondoId, claseId }),
    })
  })

  return funds
}

export async function fetchFundDetail(fondoId, claseId) {
  const response = await cafciGet(
    `${cafciBaseUrl}/fondos/${fondoId}?clase=${claseId}`,
  )
  const $ = load(response.data)

  const title = $('#titlePage .encuentreColortxt').text().trim()
  const name = title ? title.split('\n')[0].trim() : null
  const date = parseDate(title)

  if (!name) {
    return null
  }

  const performance = {}
  $('#consulta table.tablaRendimientos tr').each((_, element) => {
    const cells = $(element).find('td')

    if (cells.length < 2) {
      return
    }

    const label = $(cells[0]).text().trim()
    const value = $(cells[1]).text().trim()

    switch (label) {
      case 'Valor Cuotaparte':
        performance.shareValue = parseMixedNumber(value)
        break
      case '7 días':
        performance.last7Days = parseNumber(value)
        break
      case '1 mes':
        performance.oneMonth = parseNumber(value)
        break
      case '90 días':
        performance.ninetyDays = parseNumber(value)
        break
      case '180 días':
        performance.oneHundredEightyDays = parseNumber(value)
        break
      case 'En el año':
        performance.yearToDate = parseNumber(value)
        break
      case '12 meses':
        performance.twelveMonths = parseNumber(value)
        break
    }
  })

  let assetsUnderManagement = null
  const fundText = $('#cuotaparte').text()
  const assetsMatch = fundText.match(
    /Patrimonio bajo administración:\s*\$?\s*([\d.,]+)/,
  )
  if (assetsMatch) {
    assetsUnderManagement = parseMixedNumber(assetsMatch[1])
  }

  const portfolioComposition = []
  const portfolioCanvas = $('#cartera canvas[data-pie-chart-items-value]')
  const rawPortfolio = portfolioCanvas.attr('data-pie-chart-items-value')
  if (rawPortfolio) {
    try {
      const parsedPortfolio = JSON.parse(rawPortfolio)
      if (Array.isArray(parsedPortfolio)) {
        for (const item of parsedPortfolio) {
          portfolioComposition.push({
            name: item.nombre,
            percentage: item.porcentaje,
          })
        }
      }
    } catch {}
  }

  const ratings = []
  $('#calificacion table.tablaDatos tr').each((index, element) => {
    if (index === 0) {
      return
    }

    const cells = $(element).find('td')
    if (cells.length < 3) {
      return
    }

    ratings.push({
      agency: $(cells[0]).text().trim(),
      rating: $(cells[1]).text().trim(),
      date: parseDate($(cells[2]).text().trim()),
    })
  })

  const fees = {}
  $('#honorarios table.tablaDatos').each((index, table) => {
    const values = $(table)
      .find('tr')
      .last()
      .find('td')
      .map((_, cell) => $(cell).text().trim())
      .get()

    if (index === 0) {
      fees.managerFee = parseMixedNumber(values[0])
      fees.depositaryFee = parseMixedNumber(values[1])
    }

    if (index === 1) {
      fees.entryFee = parseMixedNumber(values[0])
      fees.exitFee = parseMixedNumber(values[1])
      fees.transferFee = parseMixedNumber(values[2])
    }

    if (index === 2) {
      fees.managementExpenses = parseMixedNumber(values[0])
      fees.successFee = values[1] === '—' ? null : parseMixedNumber(values[1])
      fees.otherFees = values[2] === '—' ? null : parseMixedNumber(values[2])
    }
  })

  const fundData = {}
  $('#fichaRight .cajaBorde ul')
    .first()
    .find('li')
    .each((_, element) => {
      const text = $(element).text().trim()
      const [label, ...rest] = text.split(':')
      const value = rest.join(':').trim()

      switch (label?.trim()) {
        case 'Administradora':
          fundData.manager = value
          break
        case 'Depositaria':
          fundData.depositary = value
          break
        case 'Tipo de Renta':
          fundData.incomeType = value
          break
        case 'Tipo de DD':
          fundData.ddType = value
          break
        case 'Región':
          fundData.region = value
          break
        case 'Benchmark':
          fundData.benchmark = value
          break
        case 'Horizonte':
          fundData.horizon = value
          break
        case 'Duration':
          fundData.duration = value
          break
        case 'Moneda':
          fundData.currency = value
          break
        case 'Código CNV':
          fundData.cnvCode = value
          break
      }
    })

  let minimumInvestment = null
  let investmentCurrency = null
  let settlementDays = null

  $('#fichaRight .cajaBorde').each((_, element) => {
    const sectionTitle = $(element).find('h3').text().trim()

    if (sectionTitle === 'Inversión mínima') {
      const text = $(element).find('p.destacado').text().trim()
      const match = text.match(/^([\d.,]+)\s*(.+)?$/)
      if (match) {
        minimumInvestment = parseMixedNumber(match[1])
        investmentCurrency = match[2] ? match[2].trim() : null
      }
    }

    if (sectionTitle === 'Plazo de Liquidación') {
      const text = $(element).find('p.destacado').text().trim()
      const match = text.match(/(\d+)/)
      if (match) {
        settlementDays = Number(match[1])
      }
    }
  })

  const societies = []
  $('#fichaRight .sociedades').each((_, element) => {
    const type = $(element).find('h3').text().trim()
    const logo = $(element).find('img').attr('src')
    const name = $(element).find('span').text().trim()

    societies.push({
      type,
      name,
      logoUrl: logo ? `${cafciBaseUrl}${logo}` : null,
    })
  })

  return normalizarPayloadFondo({
    fondoId,
    claseId,
    slug: buildFundSlug({ name, fondoId, claseId }),
    name,
    date,
    manager: fundData.manager ?? null,
    depositary: fundData.depositary ?? null,
    incomeType: fundData.incomeType ?? null,
    ddType: fundData.ddType ?? null,
    region: fundData.region ?? null,
    benchmark: fundData.benchmark ?? null,
    horizon: fundData.horizon ?? null,
    duration: fundData.duration ?? null,
    currency: fundData.currency ?? null,
    cnvCode: fundData.cnvCode ?? null,
    assetsUnderManagement,
    minimumInvestment,
    investmentCurrency,
    settlementDays,
    performance,
    portfolioComposition,
    ratings,
    fees,
    societies,
  })
}

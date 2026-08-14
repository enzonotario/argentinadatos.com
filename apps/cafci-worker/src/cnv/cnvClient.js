import { load } from 'cheerio'
import axios from 'axios'

const CNV_LIST_URL =
  'https://www.cnv.gov.ar/SitioWeb/FondosComunesInversion/CuotaPartes'
const CNV_FCI_CATALOG_URL =
  'https://www.cnv.gov.ar/SitioWeb/FondosComunesInversion/GetFCIPorTipo'
const CNV_DETALLES_FCI_URL =
  'https://www.cnv.gov.ar/SitioWeb/FondosComunesInversion/DetallesFCI'
const AIF2_BASE_URL = 'https://aif2.cnv.gov.ar'
const BLOB_DOWNLOAD_URL =
  'https://blob.cnv.gov.ar/BlobWebService.svc/DownloadBlob'

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9',
}

const MONTHS_ES = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
}

function parseCnvSpanishDate(text) {
  if (!text) {
    return null
  }

  const match = String(text)
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4})$/i)

  if (!match) {
    return null
  }

  const day = Number(match[1])
  const monthKey = match[2]
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .slice(0, 3)
  const month = MONTHS_ES[monthKey]
  const year = Number(match[3])

  if (!month || !day || !year) {
    return null
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseCnvReceptionDateTime(text) {
  if (!text) {
    return null
  }

  const match = String(text)
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})\s+([a-záéíóú]+)\.?\s+(\d{4})\s+(\d{1,2}):(\d{2})$/i)

  if (!match) {
    return parseCnvSpanishDate(text)
  }

  const day = Number(match[1])
  const monthKey = match[2]
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .slice(0, 3)
  const month = MONTHS_ES[monthKey]
  const year = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])

  if (!month) {
    return null
  }

  return new Date(
    Date.UTC(year, month - 1, day, hour + 3, minute),
  ).toISOString()
}

export function parseDocumentDateFromDescription(description) {
  if (!description) {
    return null
  }

  const match = String(description)
    .toLowerCase()
    .match(/al\s+(\d{1,2}\s+[a-záéíóú]+\.?\s+\d{4})/i)

  return match ? parseCnvSpanishDate(match[1]) : null
}

/**
 * Catálogo de fondos CNV (Value = id DetallesFCI, Text = denominación).
 * Sin idTipo / con idTipo vacío la CNV devuelve el listado completo.
 */
export async function fetchCnvFciCatalog({ idTipo = '' } = {}) {
  const body = new URLSearchParams()
  if (idTipo !== '' && idTipo != null) {
    body.set('idTipo', String(idTipo))
  }

  const response = await axios.post(CNV_FCI_CATALOG_URL, body.toString(), {
    headers: {
      ...DEFAULT_HEADERS,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json, text/javascript, */*; q=0.01',
    },
  })

  const items = Array.isArray(response.data) ? response.data : []

  return items
    .map(item => ({
      id: String(item.Value ?? ''),
      text: String(item.Text ?? '').trim(),
      Value: String(item.Value ?? ''),
      Text: String(item.Text ?? '').trim(),
    }))
    .filter(item => item.id && item.text)
}

export async function fetchCnvDetallesFciHtml(detallesFciId) {
  const response = await axios.get(
    `${CNV_DETALLES_FCI_URL}/${encodeURIComponent(String(detallesFciId))}`,
    {
      headers: DEFAULT_HEADERS,
      responseType: 'text',
    },
  )

  return response.data
}

export async function fetchCnvCuotaparteDocuments() {
  const response = await axios.get(CNV_LIST_URL, {
    headers: DEFAULT_HEADERS,
    responseType: 'text',
  })

  const $ = load(response.data)
  const documents = []

  $('table tbody tr').each((_, element) => {
    const cells = $(element).find('td')

    if (cells.length < 4) {
      return
    }

    const link = $(cells[0]).find('a')
    const href = link.attr('href')
    const documentDateText = link.text().trim() || $(cells[0]).text().trim()
    const receptionText = $(cells[1]).text().trim()
    const description = $(cells[2]).text().trim()
    const documentId = $(cells[3]).text().trim()

    if (!href) {
      return
    }

    const presentationId = href.split('/').pop()
    const documentDate =
      parseDocumentDateFromDescription(description) ||
      parseCnvSpanishDate(documentDateText)

    documents.push({
      presentationUrl: href.startsWith('http')
        ? href
        : `${AIF2_BASE_URL}${href}`,
      presentationId,
      documentDate,
      documentDateText,
      receptionAt: parseCnvReceptionDateTime(receptionText),
      receptionText,
      description,
      documentId,
    })
  })

  return documents
}

export function pickLatestDocumentForDate(documents, documentDate) {
  const matches = documents.filter(doc => doc.documentDate === documentDate)

  if (matches.length === 0) {
    return null
  }

  return [...matches].sort((a, b) => {
    const aTime = a.receptionAt ? Date.parse(a.receptionAt) : 0
    const bTime = b.receptionAt ? Date.parse(b.receptionAt) : 0
    return bTime - aTime
  })[0]
}

export function pickLatestAvailableDocument(documents) {
  if (!documents.length) {
    return null
  }

  const byDate = new Map()

  for (const document of documents) {
    if (!document.documentDate) {
      continue
    }

    const current = byDate.get(document.documentDate)
    if (!current) {
      byDate.set(document.documentDate, document)
      continue
    }

    const currentTime = current.receptionAt
      ? Date.parse(current.receptionAt)
      : 0
    const nextTime = document.receptionAt ? Date.parse(document.receptionAt) : 0

    if (nextTime >= currentTime) {
      byDate.set(document.documentDate, document)
    }
  }

  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))
  return byDate.get(dates[0]) ?? null
}

export async function fetchPresentationExcelMeta(presentationUrl) {
  const response = await axios.get(presentationUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    responseType: 'text',
  })

  const match = response.data.match(
    /"nombreArchivo"\s*:\s*"([^"]+\.xlsx)"[^]*?"guid"\s*:\s*"([0-9a-f-]{36})"/i,
  )

  if (!match) {
    throw new Error(
      `No se encontró el Excel adjunto en la presentación: ${presentationUrl}`,
    )
  }

  return {
    fileName: match[1],
    blobId: match[2],
  }
}

export async function downloadCnvExcelByBlobId(blobId) {
  const valetResponse = await axios.get(
    `${AIF2_BASE_URL}/api/ValetKeyProvider/GetPublicValetKey/${blobId}`,
    {
      params: { operation: 'DownloadBlob' },
    },
  )

  const valetKeyData = valetResponse.data?.valetKeyData

  if (!valetKeyData) {
    throw new Error(`ValetKey vacío para blob ${blobId}`)
  }

  const body = new URLSearchParams({ ValetKey: valetKeyData })
  const downloadResponse = await axios.post(
    `${BLOB_DOWNLOAD_URL}/${blobId}`,
    body.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      responseType: 'arraybuffer',
    },
  )

  return Buffer.from(downloadResponse.data)
}

export async function downloadCnvDocumentExcel(document) {
  const meta = await fetchPresentationExcelMeta(document.presentationUrl)
  const buffer = await downloadCnvExcelByBlobId(meta.blobId)

  return {
    ...meta,
    buffer,
    document,
  }
}

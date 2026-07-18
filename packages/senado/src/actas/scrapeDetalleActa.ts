import type { ActaData, VotoData } from './parseActa.ts'
import { ResultadoEnum, VotoEnum } from './parseActa.ts'
import { parse as parseDate } from 'date-fns'
import * as cheerio from 'cheerio'

const DETALLE_ACTA_URL = 'https://www.senado.gob.ar/votaciones/detalleActa'

export async function fetchDetalleActaHtml(actaId: number): Promise<string> {
  const response = await fetch(`${DETALLE_ACTA_URL}/${actaId}`)
  return await response.text()
}

export function scrapeTituloFromHtml(html: string): string {
  const $ = cheerio.load(html)

  return ($('div.row div.col-lg-6.col-sm-6:first-child p:nth-child(2)')
    .text()
    .trim())
    .replace(/[\n\t\r]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Parsea cabecera + votos individuales desde el HTML de detalleActa.
 * Útil cuando el PDF es del diario de sesiones (PageMaker/InDesign)
 * y no incluye la tabla Nombre Completo / Voto.
 */
export function parseDetalleActaHtml(
  html: string,
  actaId: number,
  titulo = '',
): ActaData {
  const $ = cheerio.load(html)

  const headerCol = $('div.row div.col-lg-6.col-sm-6').first()
  const actaText = headerCol.find('p').first().text()
  const actaMatch = actaText.match(/Acta Nro:\s*(.+)/i)
  const acta = actaMatch?.[1]?.trim() || ''

  const tituloFromHtml = scrapeTituloFromHtml(html)
  const finalTitulo = titulo || tituloFromHtml

  const spans = headerCol
    .find('span')
    .toArray()
    .map(el => $(el).text().replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const fechaSpan = spans.find(s => /^\d{2}\/\d{2}\/\d{4}/.test(s)) || ''
  const mayoria = spans.find(s => !/^\d{2}\/\d{2}\/\d{4}/.test(s)) || ''

  const resultadoText = $('p')
    .filter((_, el) => {
      const style = $(el).attr('style') || ''
      return style.includes('2.7em')
    })
    .first()
    .text()
    .trim()

  const descripcion = $('ul li p')
    .toArray()
    .map(el => $(el).text().trim())
    .find(text => /general|particular/i.test(text)) || ''

  const afirmativos = readCount($, 'AFIRMATIVOS')
  const negativos = readCount($, 'NEGATIVOS')
  const abstenciones = readCount($, 'ABSTENCIONES')
  const ausentes = readCount($, 'AUSENTES')
  const presentes = afirmativos + negativos + abstenciones

  const votos = scrapeVotosFromHtml($)

  return {
    actaId,
    titulo: finalTitulo,
    proyecto: finalTitulo,
    descripcion,
    quorumTipo: '',
    fecha: parseFechaHtml(fechaSpan),
    acta,
    mayoria,
    miembros: presentes + ausentes,
    afirmativos,
    negativos,
    abstenciones,
    presentes,
    ausentes,
    amn: 0,
    resultado: mapHtmlResultado(resultadoText),
    votos,
    observaciones: [],
  }
}

function readCount($: cheerio.CheerioAPI, label: string): number {
  const h4 = $('h4')
    .filter((_, el) => $(el).text().replace(/\s+/g, ' ').trim().toUpperCase() === label)
    .first()

  if (!h4.length) {
    return 0
  }

  const value = h4.prevAll('h3').first().text().trim()
    || h4.parent().find('h3').first().text().trim()

  return Number.parseInt(value, 10) || 0
}

function scrapeVotosFromHtml($: cheerio.CheerioAPI): VotoData[] {
  return $('#tabla tbody tr')
    .toArray()
    .map((row) => {
      const cells = $(row).find('td')
      const nombre = cells.eq(1).text().replace(/\s+/g, ' ').trim()
      const votoText = cells.eq(4).text().replace(/\s+/g, ' ').trim()

      if (!nombre || !votoText) {
        return null
      }

      return {
        nombre,
        voto: mapHtmlVoto(votoText),
        banca: '',
      }
    })
    .filter((voto): voto is VotoData => voto !== null)
}

export function mapHtmlVoto(voto: string): VotoEnum | string {
  const normalized = stripAccents(voto.trim().toLowerCase())

  switch (normalized) {
    case 'afirmativo':
      return VotoEnum.Si
    case 'negativo':
      return VotoEnum.No
    case 'ausente':
      return VotoEnum.Ausente
    case 'abstencion':
      return VotoEnum.Abstencion
    case 'no emite':
    case 'no emitio':
      return VotoEnum.NoEmite
    case 'lev.vot.':
    case 'lev.vot':
      return VotoEnum.LevVot
    default:
      console.warn(`Voto HTML desconocido: ${voto}`)
      return voto
  }
}

function mapHtmlResultado(resultado: string): ResultadoEnum | string {
  const normalized = stripAccents(resultado.trim().toLowerCase())

  switch (normalized) {
    case 'afirmativo':
    case 'afirmativa':
      return ResultadoEnum.Afirmativa
    case 'negativo':
    case 'negativa':
      return ResultadoEnum.Negativa
    case 'cancelada lev.vot.':
    case 'cancelada lev.vot':
      return ResultadoEnum.CanceladaLevVot
    default:
      return resultado
  }
}

function parseFechaHtml(fecha: string): string {
  if (!fecha) {
    return ''
  }

  const withSeconds = fecha.includes(':') && fecha.split(':').length === 2
    ? `${fecha}:00`
    : fecha

  const formats = [
    'dd/MM/yyyy - HH:mm:ss',
    'dd/MM/yyyy HH:mm:ss',
    'dd/MM/yyyy - HH:mm',
    'dd/MM/yyyy HH:mm',
  ]

  for (const format of formats) {
    const parsed = parseDate(withSeconds, format, new Date())
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return ''
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

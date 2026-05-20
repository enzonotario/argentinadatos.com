import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerPlazoFijoPrecancelable',
  tipo: 'extraccion',
})

export async function extraerPlazoFijoPrecancelable() {
  try {
    const proveedores = [
      ...(await extraerBna()),
      ...(await extraerBbva()),
      ...(await extraerProvincia()),
    ]

    return proveedores
  } catch (error) {
    logError(log, error)
    return []
  }
}

async function extraerBna() {
  try {
    const enlace = 'https://www.bna.com.ar/personas/plazofijoprecancelableuva'
    const respuesta = await axios.get(enlace)
    const $ = load(respuesta.data)

    const texto = $('body').text().replace(/\s+/g, ' ')

    const rangoTasas = texto.match(
      /De\s+(\d+)\s+a\s+(\d+)\s+([\d,.]+)%[^\d]+([\d,.]+)%/,
    )

    const tasaPrecancelacion = texto.match(
      /Cancelaciones anticipadas.*?TNA:\s*([\d,.]+)%.*?TEA:\s*([\d,.]+)%/i,
    )

    return [
      {
        id: 'bna',
        entidad: 'Banco de la Nación Argentina',
        logo: 'https://www.bna.com.ar/Content/img/logo-bna.png',
        enlace,
        canal: 'App BNA+, Home Banking y sucursales',
        moneda: 'ARS',
        plazoMinDias:
          extraerEntero(texto, /Plazo mínimo:\s*(\d+)\s*días/i) || 180,
        plazoMaxDias:
          extraerEntero(texto, /Plazo máximo:\s*(\d+)\s*días/i) || 370,
        plazoPrecancelacionDias:
          extraerEntero(texto, /Transcurrido\s+(\d+)\s+días/i) || 30,
        avisoPrecancelacionDias:
          extraerEntero(texto, /anticipación de\s+(\d+)\s+días hábiles/i) || 5,
        montoMinimo: extraerMonto(texto, /Monto mínimo:\s*\$?\s*([\d.]+)/i),
        montoMaximo: extraerMonto(
          texto,
          /tope de\s*\$?\s*([\d.]+)\s*millones/i,
          1000000,
        ),
        modalidad: extraerValor(texto, /Modalidad:\s*([^\.]+)/i),
        tna: rangoTasas ? parsearPorcentaje(rangoTasas[3]) : null,
        tea: rangoTasas ? parsearPorcentaje(rangoTasas[4]) : null,
        tnaPrecancelacion: tasaPrecancelacion
          ? parsearPorcentaje(tasaPrecancelacion[1])
          : null,
        teaPrecancelacion: tasaPrecancelacion
          ? parsearPorcentaje(tasaPrecancelacion[2])
          : null,
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}

async function extraerBbva() {
  try {
    const enlace =
      'https://www.bbva.com.ar/economia-para-tu-dia-a-dia/ef/plazos-fijos/que-es-plazo-fijo-uva.html'

    const respuesta = await axios.get(enlace)
    const $ = load(respuesta.data)

    const texto = $('body').text().replace(/\s+/g, ' ')

    return [
      {
        id: 'bbva',
        entidad: 'BBVA Banco Argentina',
        logo: 'https://www.bbva.com.ar/content/dam/public-web/global/images/logos/logo_bbva.svg',
        enlace,
        canal: null,
        moneda: 'ARS',
        plazoMinDias: 180,
        plazoMaxDias: null,
        plazoPrecancelacionDias:
          extraerEntero(texto, /a partir de los\s+(\d+)\s+días/i) || 31,
        avisoPrecancelacionDias: null,
        montoMinimo: null,
        montoMaximo: null,
        modalidad: null,
        tna: extraerPorcentaje(texto, /UVA \+ TNA del\s+([\d,.]+)%/i),
        tea: null,
        tnaPrecancelacion: null,
        teaPrecancelacion: null,
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}

async function extraerProvincia() {
  try {
    const enlace =
      'https://www.bancoprovincia.com.ar/mvc/productos/inversiones/Plazo_Fijo_uva_cancel_ant/Plazo_Fijo_uva_ca_info_gral'

    const respuesta = await axios.get(enlace)
    const $ = load(respuesta.data)

    const texto = $('body').text().replace(/\s+/g, ' ')

    return [
      {
        id: 'banco-provincia',
        entidad: 'Banco de la Provincia de Buenos Aires',
        logo: 'https://www.bancoprovincia.com.ar/CDN/Get/logo_2021.svg',
        enlace,
        canal: extraerValor(texto, /Canal:\s*([^]+?)\s+Plazo:/i),
        moneda: 'ARS',
        plazoMinDias:
          extraerEntero(texto, /Plazo:\s*mínimo\s+(\d+)\s+días/i) ||
          extraerEntero(texto, /mínimo de\s+(\d+)\s+días/i) ||
          90,
        plazoMaxDias: null,
        plazoPrecancelacionDias:
          extraerEntero(texto, /a partir del día\s+(\d+)/i) || 30,
        avisoPrecancelacionDias: null,
        montoMinimo: extraerMonto(texto, /Monto inicial:\s*\$?\s*([\d.]+)/i),
        montoMaximo: null,
        modalidad: extraerValor(texto, /CARÁCTER\s+([^]+?)\s+SIN RENOVACIÓN/i),
        tna: extraerPorcentaje(texto, /TNAV:\s*([\d,.]+)%/i),
        tea: extraerPorcentaje(texto, /TEAV\)\s*([\d,.]+)%/i),
        tnaPrecancelacion: extraerPorcentaje(
          texto,
          /tasa fija de precancelación del\s+([\d,.]+)%/i,
        ),
        teaPrecancelacion: null,
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}

function extraerEntero(texto, patron) {
  const coincidencia = texto.match(patron)

  if (!coincidencia) return null

  const numero = Number.parseInt(coincidencia[1], 10)

  return Number.isNaN(numero) ? null : numero
}

function extraerMonto(texto, patron, multiplicador = 1) {
  const coincidencia = texto.match(patron)

  if (!coincidencia) return null

  const numero = Number.parseInt(coincidencia[1].replace(/\./g, ''), 10)

  return Number.isNaN(numero) ? null : numero * multiplicador
}

function extraerValor(texto, patron) {
  const coincidencia = texto.match(patron)

  if (!coincidencia) return null

  const valor = coincidencia[1].replace(/\s+/g, ' ').trim()

  return valor || null
}

function extraerPorcentaje(texto, patron) {
  const coincidencia = texto.match(patron)
  return coincidencia ? parsearPorcentaje(coincidencia[1]) : null
}

function parsearPorcentaje(valor) {
  if (!valor) return null

  const limpio = valor.replace('%', '').replace(',', '.').trim()

  const numero = Number.parseFloat(limpio)

  return Number.isNaN(numero) ? null : numero / 100
}

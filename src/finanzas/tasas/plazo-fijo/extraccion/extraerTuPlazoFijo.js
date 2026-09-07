import { interpretarDecimalConComa } from '@/utils/numeros.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

export const URL_TU_PLAZO_FIJO_HOMEBANKING =
  'https://www.tuplazofijo.com.ar/plazos-fijos/tasas/homebanking/'

const PLAZOS_HOMEBANKING = [
  { plazoMinDias: 30, plazoMaxDias: 30 },
  { plazoMinDias: 60, plazoMaxDias: 60 },
  { plazoMinDias: 90, plazoMaxDias: 90 },
  { plazoMinDias: 365, plazoMaxDias: 365 },
]

const MAPEO_ENTIDAD_BCRA_A_TU_PLAZO_FIJO = {
  'BANCO DE LA NACION ARGENTINA': 'Banco Nación',
  'BANCO DE GALICIA Y BUENOS AIRES S.A.': 'Banco Galicia',
  'BANCO BBVA ARGENTINA S.A.': 'BBVA',
  'BANCO SANTANDER ARGENTINA S.A.': 'Santander',
  'BANCO DE LA PROVINCIA DE BUENOS AIRES': 'Banco Provincia',
  'BANCO MACRO S.A.': 'Banco Macro',
  'INDUSTRIAL AND COMMERCIAL BANK OF CHINA (ARGENTINA) S.A.U.': 'ICBC',
  'BANCO DE LA CIUDAD DE BUENOS AIRES': 'Banco Ciudad',
  'BANCO CREDICOOP COOPERATIVO LIMITADO': 'Banco Credicoop',
  'BANCO DE FORMOSA S.A.': 'Banco Formosa',
  'BANCO HIPOTECARIO S.A.': 'Banco Hipotecario',
  'BANCO DE LA PROVINCIA DE CORDOBA S.A.': 'Bancor',
  'BANCO MERIDIAN S.A.': 'Banco Meridian',
  'REBA COMPAÑIA FINANCIERA S.A.': 'Reba',
}

function normalizarNombreEntidad(nombre) {
  return (nombre ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function resolverUrlRelativa(url) {
  if (!url) {
    return null
  }

  if (url.startsWith('http')) {
    return url
  }

  return new URL(url, URL_TU_PLAZO_FIJO_HOMEBANKING).href
}

function interpretarTnaPorcentaje(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null
  }

  const numerico =
    typeof valor === 'number'
      ? valor
      : interpretarDecimalConComa(String(valor).replace('%', '').trim())

  if (Number.isNaN(numerico)) {
    return null
  }

  return numerico / 100
}

function extraerBancosV2Tasas(html) {
  const inicioAsignacion = html.search(/window\.V2_TASAS\s*=\s*\{/)

  if (inicioAsignacion < 0) {
    return []
  }

  const inicioBancos = html.indexOf('bancos:', inicioAsignacion)

  if (inicioBancos < 0) {
    return []
  }

  const inicioArray = html.indexOf('[', inicioBancos)

  if (inicioArray < 0) {
    return []
  }

  let profundidad = 0

  for (let indice = inicioArray; indice < html.length; indice += 1) {
    const caracter = html[indice]

    if (caracter === '[') {
      profundidad += 1
    } else if (caracter === ']') {
      profundidad -= 1

      if (profundidad === 0) {
        try {
          const bancos = JSON.parse(html.slice(inicioArray, indice + 1))

          return Array.isArray(bancos) ? bancos : []
        } catch {
          return []
        }
      }
    }
  }

  return []
}

function mapearBancoV2Tasas(banco) {
  const entidad = banco?.nombre?.trim()

  if (!entidad || !banco?.t || typeof banco.t !== 'object') {
    return null
  }

  const tasas = []

  for (const plazo of PLAZOS_HOMEBANKING) {
    const clave = String(plazo.plazoMinDias)
    const tna = interpretarTnaPorcentaje(banco.t[clave])

    if (tna === null || tna <= 0) {
      continue
    }

    tasas.push({
      montoMinimo: null,
      montoMaximo: null,
      ...plazo,
      tna,
    })
  }

  if (tasas.length === 0) {
    return null
  }

  const slug = banco.slug?.trim()

  return {
    entidad,
    enlace: slug
      ? resolverUrlRelativa(`/plazos-fijos/bancos/${slug}/`)
      : null,
    logo: slug
      ? resolverUrlRelativa(`/img/bancos/${slug}-round-65x65.png`)
      : null,
    tasas: ordenarTasas(tasas),
  }
}

function ordenarTasas(tasas) {
  return [...tasas].sort((a, b) => {
    const plazoA = a.plazoMinDias ?? 0
    const plazoB = b.plazoMinDias ?? 0

    if (plazoA !== plazoB) {
      return plazoA - plazoB
    }

    return (a.montoMinimo ?? 0) - (b.montoMinimo ?? 0)
  })
}

function mismoPlazo(a, b) {
  return (
    a.plazoMinDias === b.plazoMinDias && a.plazoMaxDias === b.plazoMaxDias
  )
}

export function entidadUsaExtraccionPropiaPlazoFijo(entidad) {
  const normalizada = normalizarNombreEntidad(entidad)

  return normalizada.includes('VOII') || normalizada.includes('UALA')
}

export function esEntidadTuPlazoFijoExcluida(nombreTuPlazoFijo) {
  return entidadUsaExtraccionPropiaPlazoFijo(nombreTuPlazoFijo)
}

export function buscarRegistroTuPlazoFijo(entidad, registrosPorNombre) {
  const entidadNormalizada = entidad?.trim()

  if (!entidadNormalizada) {
    return null
  }

  const alias = MAPEO_ENTIDAD_BCRA_A_TU_PLAZO_FIJO[entidadNormalizada]

  if (alias && registrosPorNombre.has(alias)) {
    return registrosPorNombre.get(alias)
  }

  const objetivo = normalizarNombreEntidad(entidadNormalizada)

  for (const [nombre, registro] of registrosPorNombre) {
    if (normalizarNombreEntidad(nombre) === objetivo) {
      return registro
    }
  }

  return null
}

export function combinarTasasPlazoFijo(tasasExistentes, tasasTuPlazoFijo) {
  const existentes = tasasExistentes ?? []
  const adicionales = (tasasTuPlazoFijo ?? []).filter(
    tramo => tramo.plazoMinDias !== 30,
  )
  const nuevas = adicionales.filter(
    tramo => !existentes.some(existente => mismoPlazo(existente, tramo)),
  )

  if (nuevas.length === 0) {
    return existentes.length > 0 ? existentes : undefined
  }

  return ordenarTasas([...existentes, ...nuevas])
}

export function parsearTasasHomebankingTuPlazoFijo(html) {
  if (!html || typeof html !== 'string') {
    return []
  }

  return extraerBancosV2Tasas(html)
    .map(mapearBancoV2Tasas)
    .filter(Boolean)
}

export function enriquecerPlazoFijoConTuPlazoFijo(items, registrosTuPlazoFijo) {
  if (!Array.isArray(items) || items.length === 0) {
    return items ?? []
  }

  if (!Array.isArray(registrosTuPlazoFijo) || registrosTuPlazoFijo.length === 0) {
    return items
  }

  const registrosPorNombre = new Map(
    registrosTuPlazoFijo.map(registro => [registro.entidad, registro]),
  )
  const nombresTuPlazoFijoUsados = new Set()

  const enriquecidos = items.map(item => {
    const registro = buscarRegistroTuPlazoFijo(item.entidad, registrosPorNombre)

    if (!registro) {
      return item
    }

    nombresTuPlazoFijoUsados.add(registro.entidad)

    if (entidadUsaExtraccionPropiaPlazoFijo(item.entidad)) {
      return item
    }

    const tasas = combinarTasasPlazoFijo(item.tasas, registro.tasas)

    if (!tasas) {
      return item
    }

    return {
      ...item,
      tasas,
    }
  })

  const nuevos = registrosTuPlazoFijo
    .filter(registro => !nombresTuPlazoFijoUsados.has(registro.entidad))
    .filter(registro => !esEntidadTuPlazoFijoExcluida(registro.entidad))
    .map(registro => {
      const tna30Dias =
        registro.tasas.find(tramo => tramo.plazoMinDias === 30)?.tna ?? null

      return {
        entidad: registro.entidad,
        logo: registro.logo,
        tnaClientes: tna30Dias,
        tnaNoClientes: tna30Dias,
        enlace: registro.enlace,
        tasas: registro.tasas,
      }
    })

  return [...enriquecidos, ...nuevos]
}

export async function extraerTuPlazoFijoHomebanking() {
  const log = logGrupo({
    fuente: 'extraerTuPlazoFijo',
    tipo: 'plazoFijo',
  })

  try {
    const respuesta = await fetch(URL_TU_PLAZO_FIJO_HOMEBANKING)

    if (!respuesta.ok) {
      throw new Error(
        `Error al obtener tasas de TuPlazoFijo: ${respuesta.statusText}`,
      )
    }

    const html = await respuesta.text()
    const registros = parsearTasasHomebankingTuPlazoFijo(html)

    if (registros.length === 0) {
      throw new Error('No se encontraron tasas en TuPlazoFijo homebanking')
    }

    logMensaje(log, 'Extracción de TuPlazoFijo homebanking exitosa', {
      entidades: registros.length,
    })

    return registros
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer tasas de TuPlazoFijo homebanking', {
      errorMessage: error.message,
    })
    return []
  }
}

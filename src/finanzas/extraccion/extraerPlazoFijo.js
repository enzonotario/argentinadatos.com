import axios from 'axios'
import { extraerUalaPlazoFijo } from '@/finanzas/extraccion/extraerUala.js'
import { logGrupo, logError } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerPlazoFijo',
  tipo: 'extraccion',
})

const URL_PLAZOS_FIJOS_BCRA =
  'https://www.bcra.gob.ar/api/endpoints/plazos-fijos.php'

function tnaDesdePorcentajeBcra(valor) {
  if (valor === null || valor === undefined) {
    return null
  }

  if (typeof valor !== 'number' || isNaN(valor)) {
    return null
  }

  return valor / 100
}

export async function extraerPlazoFijo() {
  try {
    const tasas = [...(await obtenerRespuesta()), await extraerUalaPlazoFijo()]

    return tasas
  } catch (error) {
    logError(log, error)
  }
}

export async function obtenerRespuesta() {
  try {
    const respuesta = await axios.get(URL_PLAZOS_FIJOS_BCRA)
    const datos = respuesta.data

    if (!datos || !datos.success) {
      logError(
        log,
        new Error('Respuesta inválida de plazos fijos BCRA (success o datos)'),
      )
      return []
    }

    const top10 = datos.top10 || []
    const otros = datos.otros || []

    return [...top10, ...otros].map(item => ({
      entidad: item.entidad.trim(),
      logo: item.logo_url,
      tnaClientes: tnaDesdePorcentajeBcra(item.tasa_con_relacion),
      tnaNoClientes: tnaDesdePorcentajeBcra(item.tasa_sin_relacion),
      enlace: item.web || null,
    }))
  } catch (error) {
    logError(log, error)
    return []
  }
}

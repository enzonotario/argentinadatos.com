import { logMensaje } from '@/log.js'
import { obtenerCalificacionPlayStore } from '@/finanzas/remesas/extraccion/stores/playStore.js'
import { obtenerCalificacionAppStore } from '@/finanzas/remesas/extraccion/stores/appStore.js'
import { CALIFICACIONES_APPS_REMESAS } from '@/finanzas/remesas/extraccion/stores/calificacionesAppsRemesas.js'

/**
 * @typedef {object} AppStoreCalificacionesConfig
 * @property {string} nombre
 * @property {string} [playStoreUrl]
 * @property {string} [playStorePackageId]
 * @property {string} [appStoreId]
 * @property {string} [appStoreUrl]
 * @property {string} [appStoreCountry]
 */

/**
 * Obtiene calificaciones Android/iOS en paralelo.
 * Si una store falla, la otra igual se devuelve.
 *
 * @param {object} log
 * @param {AppStoreCalificacionesConfig} config
 */
export async function obtenerCalificacionesAppStores(log, config) {
  const nombre = config.nombre

  const [android, ios] = await Promise.allSettled([
    obtenerCalificacionPlayStore(log, {
      nombre,
      url: config.playStoreUrl,
      packageId: config.playStorePackageId,
    }),
    obtenerCalificacionAppStore(log, {
      nombre,
      appStoreId: config.appStoreId,
      url: config.appStoreUrl,
      country: config.appStoreCountry,
    }),
  ])

  const calificacionAndroid =
    android.status === 'fulfilled' ? android.value : null
  const calificacionIos = ios.status === 'fulfilled' ? ios.value : null

  if (android.status === 'rejected') {
    logMensaje(log, `${nombre}: falló calificación Android`, {
      errorMessage: android.reason?.message,
    })
  }

  if (ios.status === 'rejected') {
    logMensaje(log, `${nombre}: falló calificación iOS`, {
      errorMessage: ios.reason?.message,
    })
  }

  return { calificacionAndroid, calificacionIos }
}

/**
 * Si hay config de stores para la compañía, pisa las calificaciones con
 * Play Store / App Store (fuente directa, no Dolarito).
 */
export async function enriquecerRemesaConCalificaciones(log, remesa) {
  const clave = remesa?.compania?.toLowerCase()
  const config = clave ? CALIFICACIONES_APPS_REMESAS[clave] : null

  if (!config) {
    return remesa
  }

  const calificaciones = await obtenerCalificacionesAppStores(log, config)

  return {
    ...remesa,
    calificacionAndroid:
      calificaciones.calificacionAndroid ?? remesa.calificacionAndroid ?? null,
    calificacionIos:
      calificaciones.calificacionIos ?? remesa.calificacionIos ?? null,
  }
}

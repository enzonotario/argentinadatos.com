import { extraerBelo } from '@/finanzas/criptopesos/extraccion/extraerBelo.js'
import { extraerCapyfi } from '@/finanzas/criptopesos/extraccion/extraerCapyfi.js'
import { extraerRipio } from '@/finanzas/criptopesos/extraccion/extraerRipio.js'
import { guardarCriptopesos } from '@/finanzas/criptopesos/guardado/guardarCriptopesos.js'

export async function ejecutarCriptopesos() {
  try {
    const [belo, capyfi, ripio] = await Promise.all([
      extraerBelo(),
      extraerCapyfi(),
      extraerRipio(),
    ])

    const datos = [...belo, ...capyfi, ...ripio]

    await guardarCriptopesos(datos)
  } catch (error) {
    console.error('Error al extraer criptopesos', error)
  }
}

export default ejecutarCriptopesos

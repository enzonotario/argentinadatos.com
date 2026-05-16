import { extraerCuentasRemuneradasUsd } from '@/finanzas/cuentas-remuneradas-usd/extraccion/extraerCuentasRemuneradasUsd.js'
import { guardarCuentasRemuneradasUsd } from '@/finanzas/cuentas-remuneradas-usd/guardado/guardarCuentasRemuneradasUsd.js'

export async function ejecutarCuentasRemuneradasUsd() {
  try {
    const datos = await extraerCuentasRemuneradasUsd()
    await guardarCuentasRemuneradasUsd(datos)
  } catch (error) {
    console.error('Error al extraer cuentas remuneradas USD', error)
  }
}

export default ejecutarCuentasRemuneradasUsd

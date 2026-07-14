import { format, subDays, addDays, isBefore as esAntes } from 'date-fns'
import { escribirRuta } from '@/utils/rutas.js'
import { guardarRendimientos } from '@/finanzas/rendimientos/guardarRendimientos.js'
import { extraerNexo } from '@/finanzas/rendimientos/extraerNexo.js'
import { extraerFiwind } from '@/finanzas/rendimientos/extraerFiwind.js'
import { extraerLetsbit } from '@/finanzas/rendimientos/extraerLetsbit.js'
import { extraerBelo } from '@/finanzas/rendimientos/extraerBelo.js'
import { extraerLemoncash } from '@/finanzas/rendimientos/extraerLemoncash.js'
import { extraerRipio } from '@/finanzas/rendimientos/extraerRipio.js'
import { extraerSatoshiTango } from '@/finanzas/rendimientos/extraerSatoshiTango.js'
import { extraerLucaMoney } from '@/finanzas/rendimientos/extraerLucaMoney.js'
import { extraerDecrypto } from '@/finanzas/rendimientos/extraerDecrypto.js'
import { extraerVesseo } from '@/finanzas/rendimientos/extraerVesseo.js'
import { extraerAstroPay } from '@/finanzas/rendimientos/extraerAstroPay.js'
import { extraerLunefi } from '@/finanzas/rendimientos/extraerLunefi.js'
import { extraerBerry } from '@/finanzas/rendimientos/extraerBerry.js'

export default async function () {
  const entidades = {
    nexo: await extraerNexo(),
    fiwind: await extraerFiwind(),
    letsbit: await extraerLetsbit(),
    belo: await extraerBelo(),
    lemoncash: await extraerLemoncash(),
    ripio: await extraerRipio(),
    satoshitango: await extraerSatoshiTango(),
    lucamoney: await extraerLucaMoney(),
    decrypto: await extraerDecrypto(),
    vesseo: await extraerVesseo(),
    astropay: await extraerAstroPay(),
    lunefi: await extraerLunefi(),
    berry: await extraerBerry(),
  }

  for (const [entidad, rendimientos] of Object.entries(entidades)) {
    await guardarRendimientos(entidad, rendimientos)
  }

  await escribirRuta(
    '/finanzas/rendimientos',
    Object.entries(entidades).map(([entidad, rendimientos]) => ({
      entidad,
      rendimientos,
    })),
  )

  return true
}

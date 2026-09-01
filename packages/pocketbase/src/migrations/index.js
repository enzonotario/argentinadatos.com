import * as cauciones from './002_cauciones.js'
import * as letras from './003_letras.js'
import * as criptopesos from './004_criptopesos.js'
import * as cuentasRemuneradasUsd from './005_cuentas_remuneradas_usd.js'
import * as fciOtros from './006_fci_otros.js'
import * as remExpectativas from './008_rem_expectativas.js'
import * as congreso from './009_congreso.js'
import * as relaxZeroNumbers from './010_relax_zero_numbers.js'

/** Orden estricto de migraciones PocketBase. */
export const migrations = [
  cauciones,
  letras,
  criptopesos,
  cuentasRemuneradasUsd,
  fciOtros,
  remExpectativas,
  congreso,
  relaxZeroNumbers,
]

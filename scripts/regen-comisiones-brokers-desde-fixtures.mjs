import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsearIol } from '@/finanzas/brokers/comisiones/extraccion/extraerIol.js'
import { parsearBalanz } from '@/finanzas/brokers/comisiones/extraccion/extraerBalanz.js'
import { parsearBullPdfTexto } from '@/finanzas/brokers/comisiones/extraccion/extraerBullMarket.js'
import { parsearCocos } from '@/finanzas/brokers/comisiones/extraccion/extraerCocos.js'
import { parsearPpi } from '@/finanzas/brokers/comisiones/extraccion/extraerPpi.js'
import { parsearFiwind } from '@/finanzas/brokers/comisiones/extraccion/extraerFiwind.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fx = join(
  root,
  'tests/finanzas/brokers/comisiones/extraccion/fixtures',
)

const comisiones = [
  ...parsearIol(readFileSync(join(fx, 'iol-tarifas.html'), 'utf8')),
  ...parsearBalanz(readFileSync(join(fx, 'balanz-comisiones.html'), 'utf8')),
  ...parsearBullPdfTexto(readFileSync(join(fx, 'bull-aranceles.txt'), 'utf8')),
  ...parsearCocos(readFileSync(join(fx, 'cocos-tarifario.html'), 'utf8')),
  ...parsearPpi(readFileSync(join(fx, 'ppi-comisiones.html'), 'utf8')),
  ...parsearFiwind(readFileSync(join(fx, 'fiwind-comisiones.html'), 'utf8')),
]

const payload = {
  fechaActualizacion: new Date().toISOString(),
  comisiones,
}

const out = join(root, 'datos/v1/finanzas/brokers/comisiones/index.json')
writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`)

const porEntidad = Object.fromEntries(
  [...new Set(comisiones.map((c) => c.entidad))].map((e) => [
    e,
    comisiones.filter((c) => c.entidad === e).length,
  ]),
)
const productos = [...new Set(comisiones.map((c) => c.producto))].sort()

console.log(
  JSON.stringify({ out, filas: comisiones.length, porEntidad, productos }, null, 2),
)

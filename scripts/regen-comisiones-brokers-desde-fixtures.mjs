import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsearIol } from '@/finanzas/brokers/comisiones/extraccion/extraerIol.js'
import { parsearBalanz } from '@/finanzas/brokers/comisiones/extraccion/extraerBalanz.js'
import { parsearBullPdfTexto, parsearBullComisionesHtml } from '@/finanzas/brokers/comisiones/extraccion/extraerBullMarket.js'
import { parsearCocos } from '@/finanzas/brokers/comisiones/extraccion/extraerCocos.js'
import { parsearPpi } from '@/finanzas/brokers/comisiones/extraccion/extraerPpi.js'
import { parsearFiwind } from '@/finanzas/brokers/comisiones/extraccion/extraerFiwind.js'
import { parsearIebMas } from '@/finanzas/brokers/comisiones/extraccion/extraerIebMas.js'
import { parsearEcoValores } from '@/finanzas/brokers/comisiones/extraccion/extraerEcoValores.js'
import { parsearMacroSecuritiesTexto } from '@/finanzas/brokers/comisiones/extraccion/extraerMacroSecurities.js'
import { parsearPuenteTexto } from '@/finanzas/brokers/comisiones/extraccion/extraerPuente.js'
import { parsearGaliciaSecurities } from '@/finanzas/brokers/comisiones/extraccion/extraerGaliciaSecurities.js'
import { parsearRava } from '@/finanzas/brokers/comisiones/extraccion/extraerRava.js'
import { parsearAllariaTexto } from '@/finanzas/brokers/comisiones/extraccion/extraerAllaria.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fx = join(
  root,
  'tests/finanzas/brokers/comisiones/extraccion/fixtures',
)

const comisiones = [
  ...parsearIol(readFileSync(join(fx, 'iol-tarifas.html'), 'utf8')),
  ...parsearBalanz(readFileSync(join(fx, 'balanz-comisiones.html'), 'utf8')),
  ...parsearBullComisionesHtml(
    readFileSync(join(fx, 'bull-comisiones.html'), 'utf8'),
  ),
  ...parsearBullPdfTexto(readFileSync(join(fx, 'bull-aranceles.txt'), 'utf8')).filter(
    (f) =>
      !['acciones', 'cedears', 'bonos', 'opciones', 'futuros', 'licitaciones', 'fci'].includes(
        f.producto,
      ),
  ),
  ...parsearCocos(readFileSync(join(fx, 'cocos-tarifario.html'), 'utf8')),
  ...parsearPpi(readFileSync(join(fx, 'ppi-comisiones.html'), 'utf8')),
  ...parsearFiwind(readFileSync(join(fx, 'fiwind-comisiones.html'), 'utf8')),
  ...parsearIebMas(readFileSync(join(fx, 'iebmas-planes.html'), 'utf8')),
  ...parsearEcoValores(readFileSync(join(fx, 'eco-tarifario.html'), 'utf8')),
  ...parsearMacroSecuritiesTexto(
    readFileSync(join(fx, 'macro-aranceles.txt'), 'utf8'),
  ),
  ...parsearPuenteTexto(
    readFileSync(join(fx, 'puente-comisiones.txt'), 'utf8'),
  ),
  ...parsearGaliciaSecurities(
    readFileSync(join(fx, 'galicia-comisiones.html'), 'utf8'),
  ),
  ...parsearRava(readFileSync(join(fx, 'rava-aranceles.html'), 'utf8')),
  ...parsearAllariaTexto(
    readFileSync(join(fx, 'allaria-aranceles.txt'), 'utf8'),
  ),
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

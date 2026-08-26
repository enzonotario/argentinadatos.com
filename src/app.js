import { cronFeriados } from '@/feriados/feriados.cron.js'
import { cronFeriadosBancarios } from '@/feriados-bancarios/feriadosBancarios.cron.js'
import { cronCotizaciones } from '@/cotizaciones/cotizaciones.cron.js'
import { cronFinanzas } from '@/finanzas/finanzas.cron.js'
import fci from '@/finanzas/fci/fci.comando.js'
import fciIA from '@/finanzas/fci/fciIA.comando.js'
import riesgoPais from '@/finanzas/indices/riesgo-pais/riesgoPais.comando.js'
import confianzaGobierno from '@/politica/indices/confianza-gobierno/confianzaGobierno.comando.js'
import rendimientos from '@/finanzas/rendimientos/rendimientos.comando.js'
import criptopesos from '@/finanzas/criptopesos/criptopesos.comando.js'
import plazoFijoComando from '@/finanzas/tasas/plazo-fijo/plazoFijo.comando.js'
import plazoFijoUvaPagoPeriodicoComando from '@/finanzas/tasas/plazo-fijo-uva-pago-periodico/plazoFijoUvaPagoPeriodico.comando.js'
import letrasComando from '@/finanzas/letras/letras.comando.js'
import ejecutarBonosCer from '@/finanzas/bonos-cer/bonosCer.comando.js'
import ejecutarRemesas from '@/finanzas/remesas/remesas.comando.js'
import ejecutarComisionesCobro from '@/finanzas/cobros/comisiones/comisiones-cobro.comando.js'
import ejecutarComisionesBrokers from '@/finanzas/brokers/comisiones/comisiones-brokers.comando.js'
import cuentasRemuneradasUsdComando from '@/finanzas/cuentas-remuneradas-usd/cuentas-remuneradas-usd.comando.js'
import prestamosPersonalesComando from '@/finanzas/creditos/prestamos-personales/prestamos-personales.comando.js'
import prestamosPersonalesBcraComando from '@/finanzas/creditos/prestamos-personales-bcra/prestamos-personales-bcra.comando.js'
import remComando from '@/finanzas/rem/rem.comando.js'
import fondosFciComando from '@/finanzas/fci/fondos/fondos.comando.js'
import { runCafciFresh, parseFreshArgs } from '../apps/cafci-worker/src/runCafciFresh.js'
import presidentesComando from '@/presidentes/presidentes.comando.js'
import deployComparatasas from '@/deploy/comparatasas.comando.js'
import { actualizarOpenApiAño } from '@/utils/actualizarOpenApiAño.js'

const predefinidos = {
  diario: [
    '/v1/cotizaciones',
    '/v1/finanzas',
    '/v1/politica/indices/confianza-gobierno',
  ],
  mensual: [
    '/v1/feriados',
    '/v1/feriados-bancarios',
    '/v1/finanzas/cuentas-remuneradas-usd',
    '/v1/finanzas/remesas',
    '/v1/finanzas/cobros/comisiones',
    '/v1/finanzas/brokers/comisiones',
    '/v1/politica/indices/confianza-gobierno',
  ],
  fci: ['/v1/finanzas/fci'],
  'fci-fondos': ['/v1/finanzas/fci/fondos'],
  fciIA: ['/v1/finanzas/fciIA'],
  riesgoPais: ['/v1/finanzas/riesgo-pais'],
  confianzaGobierno: ['/v1/politica/indices/confianza-gobierno'],
  rendimientos: ['/v1/finanzas/rendimientos'],
  criptopesos: ['/v1/finanzas/criptopesos'],
  rem: ['/v1/finanzas/rem'],
  actualizarOpenApiAño: ['actualizar-openapi-year'],
}

export async function iniciar(comando) {
  const comandoDesdeArgumento = comando === undefined

  comando = comando || process.argv[2]

  if (comandoDesdeArgumento) {
    console.log('Comando: ' + comando)
  } else {
    console.log("\tComando: '" + comando + "'")
  }

  switch (comando) {
    case 'diario':
    case 'mensual':
    case 'fci':
    case 'fci-fondos':
    case 'fciIA':
    case 'riesgoPais':
    case 'confianzaGobierno':
    case 'rendimientos':
    case 'criptopesos':
    case 'rem':
      for (const path of predefinidos[comando]) {
        console.log('- ' + path)
        await iniciar(path)
      }
      break

    case '/v1/feriados':
      await cronFeriados()
      break

    case '/v1/feriados-bancarios':
      await cronFeriadosBancarios()
      break

    case '/v1/cotizaciones':
      await cronCotizaciones()
      break

    case '/v1/finanzas':
      await cronFinanzas()
      break

    case '/v1/finanzas/fci':
      await fci()
      break

    case '/v1/finanzas/fci/fondos':
      await fondosFciComando()
      break

    case 'cafci-fresh':
      await runCafciFresh(parseFreshArgs(process.argv.slice(3)))
      break

    case '/v1/finanzas/fciIA':
      await fciIA()
      break

    case '/v1/finanzas/riesgo-pais':
      await riesgoPais()
      break

    case '/v1/politica/indices/confianza-gobierno':
      await confianzaGobierno()
      break

    case '/v1/finanzas/rendimientos':
      await rendimientos()
      break

    case '/v1/finanzas/criptopesos':
      await criptopesos()
      break

    case '/v1/finanzas/plazo-fijo':
      await plazoFijoComando()
      break

    case '/v1/finanzas/tasas/plazo-fijo-uva-pago-periodico':
      await plazoFijoUvaPagoPeriodicoComando()
      break

    case '/v1/finanzas/letras':
      await letrasComando()
      break

    case '/v1/finanzas/bonos-cer':
      await ejecutarBonosCer()
      break

    case '/v1/finanzas/cuentas-remuneradas-usd':
      await cuentasRemuneradasUsdComando()
      break

    case '/v1/finanzas/creditos/prestamosPersonales':
      await prestamosPersonalesComando()
      break

    case '/v1/finanzas/creditos/prestamosPersonalesBcra':
      await prestamosPersonalesBcraComando()
      break

    case '/v1/finanzas/remesas':
      await ejecutarRemesas()
      break

    case '/v1/finanzas/cobros/comisiones':
      await ejecutarComisionesCobro()
      break

    case '/v1/finanzas/brokers/comisiones':
      await ejecutarComisionesBrokers()
      break

    case '/v1/finanzas/rem':
      await remComando()
      break

    case '/v1/presidentes':
      await presidentesComando()
      break

    case 'actualizar-openapi-year':
      await actualizarOpenApiAño()
      break

    case 'deploy:comparatasas':
      await deployComparatasas()
      break

    default:
      console.log('No se encontro el comando')
      break
  }

  if (comandoDesdeArgumento) {
    console.log('Finalizado con éxito')
  }
}

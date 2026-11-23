import { logMensaje } from '@/log.js'
import { htmlATexto } from '@/finanzas/remesas/extraccion/extraerRemesasDirectas.js'
import { normalizarRemesa } from '@/finanzas/remesas/extraccion/extraerRemesas.js'
import { enriquecerRemesaConCalificaciones } from '@/finanzas/remesas/extraccion/stores/obtenerCalificacionesAppStores.js'

const FUENTES_LEMON_REMESAS = [
  {
    nombre: 'tarjeta',
    url: 'https://lemon.me/lemon_card',
  },
  {
    nombre: 'comision',
    url: 'https://help.lemon.me/es/articles/9368802-cual-es-la-comision-y-como-calcularla',
  },
  {
    nombre: 'bridge',
    url: 'https://help.lemon.me/es/articles/9368819-que-tipo-de-cuentas-provee-bridge',
  },
  {
    nombre: 'apertura',
    url: 'https://help.lemon.me/es/articles/9369132-como-funciona-el-costo-de-apertura-de-cuenta',
  },
  {
    nombre: 'rendimientos',
    url: 'https://help.lemon.me/es/articles/15449695-cuanto-voy-a-generar-con-los-rendimientos-existen-limites',
  },
  {
    nombre: 'retiros',
    url: 'https://help.lemon.me/es/articles/5017589-cuanto-cobra-lemon-por-comprar-vender-o-transferir-crypto',
  },
  {
    nombre: 'consumos',
    url: 'https://help.lemon.me/es/articles/14669244-que-pasa-cuando-hago-consumos-en-moneda-extranjera',
  },
]

function exigir(texto, fragmento) {
  if (!texto.toLowerCase().includes(fragmento.toLowerCase())) {
    throw new Error(`Fuente oficial sin "${fragmento}"`)
  }
}

export function mapearLemonRemesas(texto) {
  exigir(texto, 'sin costo de envío ni mantenimiento')
  exigir(texto, '1.5%')
  exigir(texto, '12 USD')
  exigir(texto, 'no serás el titular de una cuenta bancaria')
  exigir(texto, '4 USD')
  exigir(texto, 'genera rendimientos')
  exigir(texto, 'Retiros en pesos')
  exigir(texto, '0,00 ARS')
  exigir(texto, '1 a 1')
  exigir(texto, '0.3%')
  exigir(texto, '0.5%')

  return normalizarRemesa({
    compania: 'Lemon',
    cuentaPropia: false,
    moneda: 'CRIPTO',
    inversiones: true,
    tarjetaUsa: false,
    costoRecibirPagos: '1.5%',
    costoMantenimientoTarjeta: '0',
    costoTarjeta: '0',
    retiroArs: '0',
    metodosRecepcion: ['ACH', 'Wire'],
    detalles: {
      cuentaPropia:
        'Bridge asigna una cuenta virtual en Lead Bank. Tenés el account number para depositar, pero no sos el titular de la cuenta bancaria. Abrirla cuesta 4 USD en USDt y se vuelve a debitar a los 12 meses si la usás.',
      costoRecibirPagos:
        'ACH doméstica e internacional: 1,5%, acreditado en USDt. Wire doméstica: 1,5% más 12 USD, con mínimo de 100 USD.',
      costoMantenimientoTarjeta:
        'La VISA Lemon Card se pide sin costo de envío ni mantenimiento.',
      costoTarjeta:
        'Un consumo en moneda extranjera pagado con USDt se procesa 1 a 1 contra el USD. Desde otra crypto, 0,3%. Desde pesos, 0,5%.',
      retiroArs: 'Los retiros en pesos son 0,00 ARS.',
      tarjetaUsa:
        'La VISA Lemon Card no está emitida en EE.UU. Las compras internacionales no pagan la percepción del 30%.',
      inversiones:
        'El saldo en dólar digital (USDt) genera rendimientos, sin tope. La tasa la publica la app y puede cambiar.',
    },
  })
}

async function obtenerTexto(url) {
  const respuesta = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; ArgentinaDatos/1.0)',
      accept: 'text/html',
    },
  })

  if (!respuesta.ok) {
    throw new Error(
      `Error al obtener ${url}: ${respuesta.status} ${respuesta.statusText}`,
    )
  }

  return htmlATexto(await respuesta.text())
}

export async function extraerLemonRemesas(log) {
  const textos = await Promise.all(
    FUENTES_LEMON_REMESAS.map(async (fuente) => {
      logMensaje(log, `Fuente oficial: lemon ${fuente.nombre}`, {
        url: fuente.url,
      })

      return obtenerTexto(fuente.url)
    }),
  )

  return enriquecerRemesaConCalificaciones(
    log,
    mapearLemonRemesas(textos.join('\n')),
  )
}

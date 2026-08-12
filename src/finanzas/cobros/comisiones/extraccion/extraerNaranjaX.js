import { logGrupo, logMensaje } from '@/log.js'

const log = logGrupo({
  fuente: 'extraerNaranjaXComisionesCobro',
  tipo: 'extraccion',
})

/**
 * Stub v1: Naranja X / Toque no tiene tabla pública estable scrapeable
 * sin bloqueos (403). Se deja cableado para no bloquear el resto.
 * @returns {Promise<Array<object>>}
 */
export async function extraerNaranjaX() {
  logMensaje(log, 'Naranja X diferido (sin datos públicos estables en v1)')
  return []
}

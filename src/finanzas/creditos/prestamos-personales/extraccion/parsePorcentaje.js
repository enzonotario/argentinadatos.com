import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'

/**
 * Convierte un porcentaje en texto ("74,00%", "114.92%", "323%") a decimal.
 * @param {string|number|null|undefined} texto
 * @param {number} [precision=4]
 * @returns {number|null}
 */
export function parsePorcentaje(texto, precision = 4) {
  if (texto === null || texto === undefined) return null

  let limpio = String(texto).replace(/%/g, '').replace(/\s/g, '').trim()

  if (!limpio) return null

  if (limpio.includes(',')) {
    // Formato AR: miles con punto, decimal con coma
    limpio = limpio.replace(/\./g, '').replace(',', '.')
  } else if (!/^\d+\.\d{1,4}$/.test(limpio)) {
    // Solo quitar puntos de miles si no parece decimal inglés (114.92)
    limpio = limpio.replace(/\./g, '')
  }

  const valor = Number.parseFloat(limpio)

  if (Number.isNaN(valor)) return null

  return porcentajeADecimal(valor, precision)
}

const MESES_ES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

/**
 * @param {number} dia
 * @param {number} mes
 * @param {number} anio
 * @returns {string|null} YYYY-MM-DD
 */
export function formatearFechaIso(dia, mes, anio) {
  if (!dia || !mes || !anio) return null

  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Parsea "23/04/2026" o "23-04-2026".
 * @param {string} texto
 * @returns {string|null}
 */
export function parseFechaSlash(texto) {
  const m = String(texto)
    .trim()
    .match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)

  if (!m) return null

  return formatearFechaIso(
    Number.parseInt(m[1], 10),
    Number.parseInt(m[2], 10),
    Number.parseInt(m[3], 10),
  )
}

/**
 * Parsea "01 DE AGOSTO DE 2026".
 * @param {string} texto
 * @returns {string|null}
 */
export function parseFechaTextoEs(texto) {
  const m = String(texto)
    .trim()
    .match(/^(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚÑ]+)\s+DE\s+(\d{4})$/i)

  if (!m) return null

  const mes = MESES_ES[m[2].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')]

  if (!mes) return null

  return formatearFechaIso(
    Number.parseInt(m[1], 10),
    mes,
    Number.parseInt(m[3], 10),
  )
}

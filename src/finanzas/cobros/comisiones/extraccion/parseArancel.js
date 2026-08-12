import { porcentajeADecimal } from '@/finanzas/compartido/utils/tasas.js'

/**
 * Parsea textos de arancel tipo "Hasta 1,53% + IVA", "0,80% + IVA", "3,14%".
 * @param {string|null|undefined} texto
 * @param {number} [precision=4]
 * @returns {{
 *   arancel: number|null,
 *   arancelEsTope: boolean,
 *   ivaAdicional: boolean,
 *   incluyeIva: boolean,
 *   acreditacionPlazoHabiles: number|null,
 *   acreditacionLabelExtra: string|null,
 * }}
 */
export function parseArancelTexto(texto, precision = 4) {
  if (texto === null || texto === undefined) {
    return {
      arancel: null,
      arancelEsTope: false,
      ivaAdicional: false,
      incluyeIva: false,
      acreditacionPlazoHabiles: null,
      acreditacionLabelExtra: null,
    }
  }

  const raw = String(texto).replace(/\u00a0/g, ' ').trim()

  if (!raw || raw === '-' || /^n\/?a$/i.test(raw) || /^consultar$/i.test(raw)) {
    return {
      arancel: null,
      arancelEsTope: false,
      ivaAdicional: false,
      incluyeIva: false,
      acreditacionPlazoHabiles: null,
      acreditacionLabelExtra: null,
    }
  }

  const arancelEsTope = /\bhasta\b/i.test(raw)
  const ivaAdicional = /\+?\s*IVA\b/i.test(raw) || /no incluyen IVA/i.test(raw)
  const incluyeIva = /\bcon IVA\b/i.test(raw) || /\bincluye IVA\b/i.test(raw)

  const pctMatch = raw.match(/([\d]+(?:[.,]\d+)?)\s*%/)
  let arancel = null

  if (pctMatch) {
    const limpio = pctMatch[1].includes(',')
      ? pctMatch[1].replace(/\./g, '').replace(',', '.')
      : pctMatch[1]
    arancel = porcentajeADecimal(Number.parseFloat(limpio), precision)
  }

  const plazoMatch = raw.match(/\((\d+)\s*d[ií]as?\s*h[aá]biles?\)/i)
  const acreditacionPlazoHabiles = plazoMatch
    ? Number.parseInt(plazoMatch[1], 10)
    : null

  return {
    arancel,
    arancelEsTope,
    ivaAdicional,
    incluyeIva,
    acreditacionPlazoHabiles,
    acreditacionLabelExtra: null,
  }
}

/**
 * @param {object} parcial
 * @returns {object}
 */
export function crearComisionCobro(parcial) {
  return {
    entidad: parcial.entidad,
    nombreComercial: parcial.nombreComercial,
    producto: parcial.producto,
    canal: parcial.canal,
    medioPago: parcial.medioPago,
    arancel: parcial.arancel ?? null,
    arancelEsTope: Boolean(parcial.arancelEsTope),
    incluyeIva: Boolean(parcial.incluyeIva),
    ivaAdicional: Boolean(parcial.ivaAdicional),
    acreditacionTipo: parcial.acreditacionTipo ?? 'desconocida',
    acreditacionPlazoHabiles:
      parcial.acreditacionPlazoHabiles === undefined
        ? null
        : parcial.acreditacionPlazoHabiles,
    acreditacionLabel: parcial.acreditacionLabel ?? null,
    moneda: parcial.moneda ?? 'ARS',
    condiciones: parcial.condiciones ?? null,
    enlace: parcial.enlace ?? null,
    vigenciaDesde: parcial.vigenciaDesde ?? null,
    vigenciaHasta: parcial.vigenciaHasta ?? null,
    metadata:
      parcial.metadata && typeof parcial.metadata === 'object'
        ? parcial.metadata
        : {},
  }
}

/**
 * @param {string|null|undefined} label
 * @returns {'inmediata'|'anticipada'|'estandar'|'desconocida'}
 */
export function inferirAcreditacionTipo(label) {
  const texto = String(label || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  if (/instant|inmediata|al instante|en el acto/.test(texto)) {
    return 'inmediata'
  }

  if (/anticipad|24\s*horas/.test(texto)) {
    return 'anticipada'
  }

  // "2 días", "10 días hábiles", "plazo estándar", etc.
  if (/estandar|d[ií]as?(?:\s+habililes?)?|plazo/.test(texto)) {
    const dias = texto.match(/(\d+)\s*d[ií]as?/)
    if (dias && Number.parseInt(dias[1], 10) === 1) {
      return 'anticipada'
    }
    return 'estandar'
  }

  return 'desconocida'
}

/**
 * @param {string|null|undefined} label
 * @returns {number|null}
 */
export function parsePlazoHabilesDesdeLabel(label) {
  const texto = String(label || '')
  const match = texto.match(/(\d+)\s*d[ií]as?/i)

  if (!match) {
    if (/instant|inmediata|al instante|en el acto/i.test(texto)) {
      return 0
    }
    return null
  }

  return Number.parseInt(match[1], 10)
}

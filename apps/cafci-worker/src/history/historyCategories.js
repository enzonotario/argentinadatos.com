export const historyCategoryLabels = {
  mercadoDinero: 'Mercado de Dinero',
  rentaFija: 'Renta Fija',
  rentaMixta: 'Renta Mixta',
  rentaVariable: 'Renta Variable',
  retornoTotal: 'Retorno Total',
}

export function inferHistoryCategoryKey(value) {
  if (!value) {
    return null
  }

  const normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

  if (normalized.includes('mercado')) {
    return 'mercadoDinero'
  }

  if (normalized.includes('renta fija')) {
    return 'rentaFija'
  }

  if (normalized.includes('renta mixta')) {
    return 'rentaMixta'
  }

  if (normalized.includes('renta variable')) {
    return 'rentaVariable'
  }

  if (normalized.includes('retorno total')) {
    return 'retornoTotal'
  }

  return null
}

export function inferHistoryCategoryLabel(key) {
  return key ? (historyCategoryLabels[key] ?? null) : null
}

export const FCI_SERIES = [
  'mercadoDinero',
  'rentaVariable',
  'rentaFija',
  'rentaMixta',
  'retornoTotal',
]

export function emptyFciSeries() {
  return Object.fromEntries(FCI_SERIES.map(serie => [serie, []]))
}

export function inferSerieKey(tipoRenta) {
  if (!tipoRenta) {
    return null
  }

  const normalized = String(tipoRenta)
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

export function mapHorizonteSerie(horizonte) {
  if (!horizonte) {
    return null
  }

  const normalized = String(horizonte)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

  if (normalized === 'cor' || normalized.includes('corto')) {
    return 'corto'
  }

  if (
    normalized === 'med' ||
    normalized.includes('mediano') ||
    normalized.includes('medio')
  ) {
    return 'medio'
  }

  if (normalized === 'lar' || normalized.includes('largo')) {
    return 'largo'
  }

  if (normalized === 'flex' || normalized.includes('flex')) {
    return 'flex'
  }

  return horizonte
}

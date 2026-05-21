export function normalizarNombreFondo(fondo) {
  if (fondo.slug) {
    return fondo.slug
  }

  if (!fondo.nombre) {
    return `${fondo.fondoId}-${fondo.claseId}`
  }

  const nombreNormalizado = fondo.nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return nombreNormalizado || `${fondo.fondoId}-${fondo.claseId}`
}

export function omitirMetadataInterna(fondo) {
  const { slug, ...publico } = fondo
  return publico
}

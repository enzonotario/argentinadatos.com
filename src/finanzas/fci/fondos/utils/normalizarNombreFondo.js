export function slugificarNombreFondo(nombre) {
  if (!nombre) {
    return null
  }

  const nombreNormalizado = String(nombre)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return nombreNormalizado || null
}

/**
 * Slug público del endpoint `/fondos/{slug}`.
 * Prioriza el nombre actual (estable para mappings) sobre el slug interno
 * congelado en SQLite, que puede quedar de un nombre viejo del Excel CNV.
 */
export function slugPublicoFondo(fondo) {
  return (
    slugificarNombreFondo(fondo?.nombre) ||
    fondo?.slug ||
    `${fondo?.fondoId}-${fondo?.claseId}`
  )
}

export function normalizarNombreFondo(fondo) {
  return slugPublicoFondo(fondo)
}

export function clavesSlugFondo(fondo) {
  return [
    ...new Set(
      [
        slugPublicoFondo(fondo),
        fondo?.slug,
        slugificarNombreFondo(fondo?.nombre),
      ].filter(Boolean),
    ),
  ]
}

export function omitirMetadataInterna(fondo) {
  const { slug, ...publico } = fondo
  return publico
}

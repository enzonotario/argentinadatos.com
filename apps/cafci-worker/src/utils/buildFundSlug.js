export function buildFundSlug({
  name,
  nombre,
  fundId,
  fondoId,
  classId,
  claseId,
}) {
  const resolvedName = name ?? nombre
  const resolvedFundId = fundId ?? fondoId
  const resolvedClassId = classId ?? claseId

  if (!resolvedName) {
    return `${resolvedFundId}-${resolvedClassId}`
  }

  const normalizedName = resolvedName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalizedName || `${resolvedFundId}-${resolvedClassId}`
}

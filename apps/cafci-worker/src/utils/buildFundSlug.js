export function buildFundSlug({ name, fundId, classId }) {
  if (!name) {
    return `${fundId}-${classId}`
  }

  const normalizedName = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalizedName || `${fundId}-${classId}`
}

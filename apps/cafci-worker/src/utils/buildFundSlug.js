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

export function allocateUniqueFundSlug(desiredSlug, { claseId, isTaken }) {
  const classKey = String(claseId ?? '')
  const base = desiredSlug || classKey || 'fondo'

  const takenByOtherClass = slug => Boolean(isTaken?.(slug))

  if (!takenByOtherClass(base)) {
    return base
  }

  const withClass = classKey ? `${base}-${classKey}` : base
  if (!takenByOtherClass(withClass)) {
    return withClass
  }

  let n = 2
  while (takenByOtherClass(`${withClass}-${n}`)) {
    n += 1
  }

  return `${withClass}-${n}`
}

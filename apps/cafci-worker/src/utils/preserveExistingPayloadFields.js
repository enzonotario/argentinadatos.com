/**
 * Conserva campos que la planilla CNV no aporta (o aporta incompletos)
 * respecto del payload CAFCI previo.
 */
export function preserveExistingPayloadFields(existingPayload, incomingPayload) {
  if (!existingPayload) {
    return incomingPayload
  }

  const merged = { ...incomingPayload }

  const existingComposicion = existingPayload.composicionCartera || []
  const incomingComposicion = incomingPayload.composicionCartera || []

  if (existingComposicion.length > 0 && incomingComposicion.length === 0) {
    merged.composicionCartera = existingComposicion

    for (const field of [
      'fechaComposicionCartera',
      'composicionActualizadaAt',
      'detallesFciId',
    ]) {
      if (
        existingPayload[field] != null &&
        existingPayload[field] !== '' &&
        (incomingPayload[field] == null || incomingPayload[field] === '')
      ) {
        merged[field] = existingPayload[field]
      }
    }
  }

  for (const field of ['benchmark', 'duracion', 'horizonte', 'region']) {
    if (
      existingPayload[field] != null &&
      existingPayload[field] !== '' &&
      (incomingPayload[field] == null || incomingPayload[field] === '')
    ) {
      merged[field] = existingPayload[field]
    }
  }

  merged.rendimientos = mergeRendimientos(
    existingPayload.rendimientos,
    incomingPayload.rendimientos,
  )

  merged.calificaciones = mergeCalificaciones(
    existingPayload.calificaciones,
    incomingPayload.calificaciones,
  )

  merged.sociedades = mergeSociedadesLogos(
    existingPayload.sociedades,
    incomingPayload.sociedades,
  )

  return merged
}

function mergeRendimientos(existingRendimientos, incomingRendimientos) {
  const existing = existingRendimientos || {}
  const incoming = incomingRendimientos || {}

  return {
    ...incoming,
    noventaDias: incoming.noventaDias ?? existing.noventaDias ?? null,
    cientoOchentaDias:
      incoming.cientoOchentaDias ?? existing.cientoOchentaDias ?? null,
    enElAnio: incoming.enElAnio ?? existing.enElAnio ?? null,
    doceMeses: incoming.doceMeses ?? existing.doceMeses ?? null,
  }
}

function normalizeRating(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\(arg\)/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

export function mergeCalificaciones(existingCalificaciones, incomingCalificaciones) {
  const existing = Array.isArray(existingCalificaciones)
    ? existingCalificaciones
    : []
  const incoming = Array.isArray(incomingCalificaciones)
    ? incomingCalificaciones
    : []

  if (incoming.length === 0) {
    return existing.length > 0 ? existing : incoming
  }

  if (existing.length === 0) {
    return incoming
  }

  return incoming.map(calificacion => {
    if (calificacion?.calificadora) {
      return calificacion
    }

    const ratingKey = normalizeRating(calificacion?.calificacion)
    const byRating = existing.find(
      item =>
        item?.calificadora &&
        normalizeRating(item.calificacion) === ratingKey,
    )
    const fallback = existing.find(item => item?.calificadora)

    const match = byRating || fallback
    if (!match) {
      return calificacion
    }

    return {
      ...calificacion,
      calificadora: match.calificadora,
      // La fecha de CNV suele ser la del documento, no la de la calificación.
      fecha: match.fecha || calificacion.fecha,
    }
  })
}

function normalizeSocietyName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function societyRoleKey(tipo) {
  const normalized = normalizeSocietyName(tipo)

  if (normalized.includes('depositaria')) {
    return 'depositaria'
  }

  if (
    normalized.includes('gerente') ||
    normalized.includes('administradora') ||
    normalized.includes('admin')
  ) {
    return 'administradora'
  }

  return normalized
}

export function mergeSociedadesLogos(existingSociedades, incomingSociedades) {
  const existing = Array.isArray(existingSociedades) ? existingSociedades : []
  const incoming = Array.isArray(incomingSociedades) ? incomingSociedades : []

  if (incoming.length === 0) {
    return existing.length > 0 ? existing : incoming
  }

  if (existing.length === 0) {
    return incoming
  }

  return incoming.map(sociedad => {
    if (sociedad?.logo) {
      return sociedad
    }

    const byName = existing.find(
      item =>
        item?.logo &&
        normalizeSocietyName(item.nombre) ===
          normalizeSocietyName(sociedad?.nombre),
    )

    if (byName?.logo) {
      return {
        ...sociedad,
        logo: byName.logo,
      }
    }

    const byRole = existing.find(
      item =>
        item?.logo &&
        societyRoleKey(item.tipo) === societyRoleKey(sociedad?.tipo),
    )

    if (byRole?.logo) {
      return {
        ...sociedad,
        logo: byRole.logo,
      }
    }

    return sociedad
  })
}

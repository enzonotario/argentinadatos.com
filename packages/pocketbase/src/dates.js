/** Normaliza fechas al formato que acepta PocketBase. */
export function toPocketBaseDate(value) {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid date: ${value}`)
    }
    return value.toISOString().replace('T', ' ')
  }

  const str = String(value)
  const day = str.match(/^(\d{4}-\d{2}-\d{2})/)
  if (day && !str.includes('T') && !str.includes(' ')) {
    return `${day[1]} 00:00:00.000Z`
  }

  const date = new Date(str)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`)
  }
  return date.toISOString().replace('T', ' ')
}

export function appliedAtNow() {
  return new Date().toISOString().replace('T', ' ')
}

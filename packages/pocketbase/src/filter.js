export function escapeFilterValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function eq(field, value) {
  if (value === null || value === undefined) {
    return `${field} = null`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${field} = ${value}`
  }
  if (typeof value === 'boolean') {
    return `${field} = ${value}`
  }
  return `${field} = "${escapeFilterValue(value)}"`
}

export function andFilters(...parts) {
  return parts.filter(Boolean).join(' && ')
}

export const PRIVATE_RULES = {
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
}

export function textField(name, { required = false, max } = {}) {
  const field = { name, type: 'text', required }
  if (max != null) field.max = max
  return field
}

export function numberField(name, { required = false, onlyInt = false } = {}) {
  return { name, type: 'number', required, onlyInt }
}

export function dateField(name, { required = false } = {}) {
  return { name, type: 'date', required }
}

export function jsonField(name, { required = false } = {}) {
  return { name, type: 'json', required }
}

export function boolField(name, { required = false } = {}) {
  return { name, type: 'bool', required }
}

export function normalizarSlugParaRuta(valor) {
  return String(valor || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

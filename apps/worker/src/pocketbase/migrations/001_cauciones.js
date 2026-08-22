import {
  CAUCIONES_COLLECTION,
  fieldNames,
} from '../schema/cauciones.js'

export const id = '001_cauciones'

/**
 * Migración única de cauciones: crea o reconcilia el schema objetivo.
 * - Crea la colección si no existe
 * - Renombra tasaPromedio → tasaActual si aplica
 * - Agrega campos faltantes y quita residuales (tasaPromedio)
 */
export async function up(pb) {
  let collection
  try {
    collection = await pb.getCollection('cauciones')
  } catch (err) {
    if (err?.response?.status !== 404) throw err
    await pb.createCollection(CAUCIONES_COLLECTION)
    console.log('[migrate] 001_cauciones created collection')
    return
  }

  const names = fieldNames(collection)
  const desiredNames = new Set(CAUCIONES_COLLECTION.fields.map(f => f.name))
  const hasPromedio = names.has('tasaPromedio')
  const hasActual = names.has('tasaActual')
  const missing = CAUCIONES_COLLECTION.fields.filter(f => !names.has(f.name))
  // tasaActual "faltante" si solo está como tasaPromedio (se resuelve por rename)
  const missingAfterRename = missing.filter(
    f => !(f.name === 'tasaActual' && hasPromedio && !hasActual),
  )
  const extras = [...names].filter(
    name =>
      name !== 'id' &&
      !desiredNames.has(name) &&
      // tasaPromedio se elimina explícitamente abajo
      name !== 'tasaPromedio',
  )

  const needsRename = hasPromedio
  const needsAdd = missingAfterRename.length > 0
  const needsDropExtras = extras.length > 0 || (hasPromedio && hasActual)

  if (!needsRename && !needsAdd && !needsDropExtras && hasActual) {
    console.log('[migrate] 001_cauciones schema already up to date')
    return
  }

  await pb.truncateCollection('cauciones')

  let fields = [...(collection.fields ?? [])]

  if (hasPromedio && !hasActual) {
    fields = fields.map(field =>
      field.name === 'tasaPromedio' ? { ...field, name: 'tasaActual' } : field,
    )
    console.log('[migrate] 001_cauciones renamed tasaPromedio → tasaActual')
  }

  fields = fields.filter(field => field.name !== 'tasaPromedio')
  if (hasPromedio && hasActual) {
    console.log('[migrate] 001_cauciones removed residual tasaPromedio')
  }

  const present = new Set(fields.map(f => f.name))
  for (const field of CAUCIONES_COLLECTION.fields) {
    if (!present.has(field.name)) {
      fields.push(field)
      present.add(field.name)
    }
  }

  // Quitar campos no deseados (excepto system id)
  fields = fields.filter(
    field => field.system || desiredNames.has(field.name),
  )

  await pb.updateCollection('cauciones', {
    fields,
    indexes: CAUCIONES_COLLECTION.indexes,
    listRule: CAUCIONES_COLLECTION.listRule,
    viewRule: CAUCIONES_COLLECTION.viewRule,
    createRule: CAUCIONES_COLLECTION.createRule,
    updateRule: CAUCIONES_COLLECTION.updateRule,
    deleteRule: CAUCIONES_COLLECTION.deleteRule,
  })

  console.log('[migrate] 001_cauciones schema reconciled', {
    added: missingAfterRename.map(f => f.name),
    removedExtras: extras,
  })
}

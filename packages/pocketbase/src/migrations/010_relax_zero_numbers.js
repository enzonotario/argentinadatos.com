/**
 * PocketBase trata `0` como blank en number `required:true`.
 * Relaja tna/tea/tasa en colecciones ya creadas (sin borrar datos).
 */
async function relaxNumberFields(pb, collectionName, fieldNames) {
  const col = await pb.getCollection(collectionName)
  const names = new Set(fieldNames)
  const fields = (col.fields ?? []).map(field => {
    if (names.has(field.name) && field.type === 'number') {
      return { ...field, required: false }
    }
    return field
  })
  await pb.updateCollection(collectionName, { fields })
  console.log(
    `[migrate] 010 relaxed required on ${collectionName}: ${fieldNames.join(', ')}`,
  )
}

export const id = '010_relax_zero_numbers'

export async function up(pb) {
  await relaxNumberFields(pb, 'criptopesos', ['tna'])
  await relaxNumberFields(pb, 'cuentas_remuneradas_usd', ['tasa'])
  await relaxNumberFields(pb, 'fci_otros', ['tna', 'tea'])
}

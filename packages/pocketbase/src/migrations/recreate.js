/** Crea la colección; si ya existe, la reemplaza (schema objetivo). */
export async function recreateCollection(pb, collection) {
  try {
    await pb.deleteCollection(collection.name)
    console.log(`[migrate] deleted existing collection ${collection.name}`)
  } catch (err) {
    if (err?.response?.status !== 404) throw err
  }
  await pb.createCollection(collection)
  console.log(`[migrate] created collection ${collection.name}`)
}

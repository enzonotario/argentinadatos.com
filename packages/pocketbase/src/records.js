export async function listAllRecords(
  pb,
  collection,
  { sort = '', filter = '', perPage = 200 } = {},
) {
  const items = []
  let page = 1
  for (;;) {
    const result = await pb.listRecords(collection, {
      page,
      perPage,
      sort,
      filter,
    })
    items.push(...(result.items ?? []))
    if (page >= (result.totalPages ?? 1)) break
    page += 1
  }
  return items
}

export async function findFirstRecord(pb, collection, { filter = '', sort = '' } = {}) {
  const result = await pb.listRecords(collection, {
    page: 1,
    perPage: 1,
    filter,
    sort,
  })
  return result.items?.[0] ?? null
}

export async function upsertByFilter(pb, collection, filter, body) {
  const existing = await findFirstRecord(pb, collection, { filter })
  if (existing) {
    return pb.updateRecord(collection, existing.id, body)
  }
  return pb.createRecord(collection, body)
}

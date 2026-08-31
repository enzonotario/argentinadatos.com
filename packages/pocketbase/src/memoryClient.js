const stores = new Map()

function randomId() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 15; i += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return id
}

function parseFilter(filter) {
  if (!filter || !String(filter).trim()) return () => true

  const parts = String(filter)
    .split('&&')
    .map(p => p.trim())
    .filter(Boolean)

  const matchers = parts.map(part => {
    const nullMatch = part.match(/^(\w+)\s*=\s*null$/)
    if (nullMatch) {
      const field = nullMatch[1]
      return row => row[field] == null
    }

    const numMatch = part.match(/^(\w+)\s*=\s*(-?\d+(?:\.\d+)?)$/)
    if (numMatch) {
      const field = numMatch[1]
      const value = Number(numMatch[2])
      return row => Number(row[field]) === value
    }

    const boolMatch = part.match(/^(\w+)\s*=\s*(true|false)$/)
    if (boolMatch) {
      const field = boolMatch[1]
      const value = boolMatch[2] === 'true'
      return row => Boolean(row[field]) === value
    }

    const strMatch = part.match(/^(\w+)\s*=\s*"((?:\\.|[^"\\])*)"$/)
    if (strMatch) {
      const field = strMatch[1]
      const value = strMatch[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      return row => String(row[field] ?? '') === value
    }

    throw new Error(`Unsupported memory filter clause: ${part}`)
  })

  return row => matchers.every(fn => fn(row))
}

function sortRows(rows, sort) {
  if (!sort) return rows
  const fields = String(sort)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  return [...rows].sort((a, b) => {
    for (const field of fields) {
      const desc = field.startsWith('-')
      const key = desc ? field.slice(1) : field
      const av = a[key]
      const bv = b[key]
      if (av === bv) continue
      if (av == null) return desc ? 1 : -1
      if (bv == null) return desc ? -1 : 1
      if (av < bv) return desc ? 1 : -1
      if (av > bv) return desc ? -1 : 1
    }
    return 0
  })
}

function httpError(status, message) {
  const err = new Error(message)
  err.response = { status, data: { message } }
  return err
}

export function resetMemoryPocketBaseStores() {
  stores.clear()
}

export function createMemoryPocketBaseClient({ scope = 'memory://default' } = {}) {
  if (!stores.has(scope)) {
    stores.set(scope, { collections: new Map() })
  }
  const store = stores.get(scope)

  return {
    url: scope,
    kind: 'memory',
    async getCollection(name) {
      const col = store.collections.get(name)
      if (!col) throw httpError(404, `Missing collection ${name}`)
      return { ...col.schema, id: col.schema.name }
    },
    async createCollection(body) {
      if (store.collections.has(body.name)) {
        throw httpError(400, `Collection ${body.name} already exists`)
      }
      store.collections.set(body.name, {
        schema: structuredClone(body),
        records: new Map(),
      })
      return { ...body, id: body.name }
    },
    async updateCollection(name, body) {
      const col = store.collections.get(name)
      if (!col) throw httpError(404, `Missing collection ${name}`)
      col.schema = { ...col.schema, ...structuredClone(body), name }
      return { ...col.schema, id: name }
    },
    async deleteCollection(name) {
      if (!store.collections.has(name)) {
        throw httpError(404, `Missing collection ${name}`)
      }
      store.collections.delete(name)
    },
    async truncateCollection(name) {
      const col = store.collections.get(name)
      if (!col) throw httpError(404, `Missing collection ${name}`)
      col.records.clear()
    },
    async createRecord(collection, body) {
      const col = store.collections.get(collection)
      if (!col) throw httpError(404, `Missing collection ${collection}`)
      const id = randomId()
      const now = new Date().toISOString()
      const record = {
        ...body,
        id,
        created: now,
        updated: now,
      }
      col.records.set(id, record)
      return structuredClone(record)
    },
    async updateRecord(collection, id, body) {
      const col = store.collections.get(collection)
      if (!col) throw httpError(404, `Missing collection ${collection}`)
      const prev = col.records.get(id)
      if (!prev) throw httpError(404, `Missing record ${id}`)
      const next = {
        ...prev,
        ...body,
        id,
        updated: new Date().toISOString(),
      }
      col.records.set(id, next)
      return structuredClone(next)
    },
    async deleteRecord(collection, id) {
      const col = store.collections.get(collection)
      if (!col) throw httpError(404, `Missing collection ${collection}`)
      if (!col.records.has(id)) throw httpError(404, `Missing record ${id}`)
      col.records.delete(id)
    },
    async listRecords(
      collection,
      { page = 1, perPage = 500, sort = '', filter = '' } = {},
    ) {
      const col = store.collections.get(collection)
      if (!col) throw httpError(404, `Missing collection ${collection}`)
      const matched = sortRows(
        [...col.records.values()].filter(parseFilter(filter)),
        sort,
      )
      const totalItems = matched.length
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage) || 1)
      const start = (page - 1) * perPage
      const items = matched
        .slice(start, start + perPage)
        .map(row => structuredClone(row))
      return {
        page,
        perPage,
        totalItems,
        totalPages,
        items,
      }
    },
  }
}
